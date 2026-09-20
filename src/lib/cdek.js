// ─────────────────────────────────────────────────────────────
// СДЭК: расчёт доставки и список пунктов выдачи.
//
// Адреса и пути сверены с официальным SDK СДЭК (cdek-it/sdk2.0):
//   боевой контур   https://api.cdek.ru/v2
//   тестовый контур https://api.edu.cdek.ru/v2
//   авторизация     POST /oauth/token   (form-urlencoded)
//   расчёт          POST /calculator/tarifflist
//   пункты выдачи   GET  /deliverypoints
//
// Ключи только в переменных окружения хостинга:
//   CDEK_CLIENT_ID, CDEK_CLIENT_SECRET — из кабинета lk.cdek.ru → «Интеграция»
//   CDEK_TEST=1 — работать на тестовом контуре
//   CDEK_FROM_POSTAL — индекс отправителя (склад в Дивеево)
//   CDEK_BOX_L/W/H — габариты коробки в мм, одна на все товары
//   CDEK_DEFAULT_WEIGHT_G — вес одной единицы товара, пока веса нет в каталоге
// ─────────────────────────────────────────────────────────────

const PROD = 'https://api.cdek.ru/v2';
const TEST = 'https://api.edu.cdek.ru/v2';

// CDEK_API_URL перекрывает адрес: нужен, чтобы прогонять расчёт на подставном
// сервере в проверках, не трогая настоящий СДЭК.
const base = () => process.env.CDEK_API_URL || (String(process.env.CDEK_TEST) === '1' ? TEST : PROD);

export function cdekStatus() {
  const { CDEK_CLIENT_ID, CDEK_CLIENT_SECRET } = process.env;
  if (!CDEK_CLIENT_ID || !CDEK_CLIENT_SECRET) {
    return { ok: false, reason: 'не заданы CDEK_CLIENT_ID и CDEK_CLIENT_SECRET' };
  }
  return { ok: true };
}

// Токен живёт около часа. Держим его в памяти процесса и просим новый заранее,
// чтобы не ловить 401 на середине расчёта.
let cached = { token: '', expiresAt: 0 };

async function token() {
  const now = Date.now();
  if (cached.token && now < cached.expiresAt - 60_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: String(process.env.CDEK_CLIENT_ID).trim(),
    client_secret: String(process.env.CDEK_CLIENT_SECRET).trim(),
  });

  const res = await fetch(`${base()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`СДЭК: авторизация не прошла, ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('СДЭК: в ответе нет токена');

  cached = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
  };
  return cached.token;
}

// Низкоуровневый вызов открыт наружу: через него работает прокси для виджета
// ПВЗ. Виджет ходит только на наш сервер, ключи СДЭКа в браузер не попадают.
export async function cdekCall(path, opts) {
  return call(path, opts);
}

async function call(path, { method = 'GET', body, query } = {}) {
  const url = new URL(base() + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`СДЭК ${path}: ${res.status} ${text.slice(0, 200)}`);
  return data;
}

// Габариты: клиент подтвердил одну коробку на весь ассортимент, 233x193x98 мм.
// ВАЖНО: СДЭК принимает габариты в САНТИМЕТРАХ, а вес в граммах.
// Переменные держим в миллиметрах, как их дал клиент, и переводим здесь.
// Без перевода коробка превращается в ящик 2,3 x 1,9 x 1 метр, объёмный вес
// улетает под две тонны, и доставка считается в сотни тысяч рублей.
const cm = (mm) => Math.max(1, Math.ceil(Number(mm) / 10));
const box = () => ({
  length: cm(process.env.CDEK_BOX_L || 233),
  width: cm(process.env.CDEK_BOX_W || 193),
  height: cm(process.env.CDEK_BOX_H || 98),
});

/**
 * Вес заказа в граммах. Берём вес товара из каталога, если он там проставлен.
 * Пока весов нет, работает значение по умолчанию, и расчёт помечается
 * приблизительным: показывать такую цену как окончательную нельзя.
 */
export function weighOrder(items) {
  const fallback = Number(process.env.CDEK_DEFAULT_WEIGHT_G) || 1000;
  let grams = 0;
  let approximate = false;
  for (const i of items) {
    const qty = Number(i.qty) || 1;
    if (i.weight) grams += Number(i.weight) * qty;
    else { grams += fallback * qty; approximate = true; }
  }
  return { grams: Math.max(grams, 100), approximate };
}

/**
 * Варианты доставки до города получателя.
 * tariffs приходят списком, мы отбираем самый дешёвый до пункта выдачи
 * и самый дешёвый курьером, остальное покупателю показывать незачем.
 */
export async function deliveryOptions({ toPostal, toCity, items }) {
  const status = cdekStatus();
  if (!status.ok) throw new Error(`СДЭК не настроен: ${status.reason}`);

  const { grams, approximate } = weighOrder(items);

  // Калькулятор СДЭКа надёжнее работает с кодом города, чем с названием текстом:
  // «Казань» существует и в Татарстане, и в Кировской области. Если индекса нет,
  // сначала превращаем название в код через справочник.
  let to = null;
  if (toPostal) {
    to = { postal_code: String(toPostal) };
  } else if (toCity) {
    const found = await findCities(String(toCity), 1);
    to = found.length ? { code: found[0].code } : { city: String(toCity) };
  }
  if (!to) throw new Error('не указан город или индекс получателя');

  const from = process.env.CDEK_FROM_CODE
    ? { code: Number(process.env.CDEK_FROM_CODE) }
    : { postal_code: String(process.env.CDEK_FROM_POSTAL || '607320') };

  const payload = {
    type: 1, // интернет-магазин
    from_location: from,
    to_location: to,
    packages: [{ weight: grams, ...box() }],
  };

  const data = await call('/calculator/tarifflist', { method: 'POST', body: payload });
  const list = Array.isArray(data.tariff_codes) ? data.tariff_codes : [];

  // Числовой delivery_mode из ответа СДЭКа оказался ненадёжным: при отборе
  // «только со склада» в него проходил тариф «Посылка дверь-постамат».
  // Поэтому разбираем название тарифа, там способ написан словами:
  // «Посылка склад-дверь», «Экспресс дверь-постамат» и так далее.
  // Первое слово — как забирают у нас, второе — как получает покупатель.
  const parseRoute = (name) => {
    const m = String(name || '').match(/(дверь|склад|постамат)\s*-\s*(дверь|склад|постамат)/i);
    return m ? { from: m[1].toLowerCase(), to: m[2].toLowerCase() } : null;
  };

  const withRoute = list.map((t) => ({ ...t, route: parseRoute(t.tariff_name) }));
  const fromDoor = String(process.env.CDEK_SHIP_FROM || 'warehouse') === 'door';
  const wantFrom = fromDoor ? 'дверь' : 'склад';

  const suitable = withRoute.filter((t) => t.route && t.route.from === wantFrom);
  // Если нужным способом СДЭК ничего не предлагает, показываем что есть:
  // пустой экран вместо цены хуже, чем неудобный тариф.
  const fallback = suitable.length === 0 && withRoute.length > 0;
  const pool = fallback ? withRoute.filter((t) => t.route) : suitable;

  const toDoor = pool.filter((t) => t.route.to === 'дверь');
  const toPoint = pool.filter((t) => t.route.to !== 'дверь');

  const cheapest = (arr) => arr.slice().sort((a, b) => a.delivery_sum - b.delivery_sum)[0] || null;

  const shape = (t, kind) => t && {
    kind,
    tariffCode: t.tariff_code,
    name: t.tariff_name,
    price: Math.round(t.delivery_sum),
    daysMin: t.period_min,
    daysMax: t.period_max,
  };

  return {
    weightGrams: grams,
    approximate,
    // shipFrom видно в ответе: иначе снаружи не отличить настройку от бага
    shipFrom: fromDoor ? 'door' : 'warehouse',
    ...(fallback ? { fallback: true } : {}),
    tariffsOffered: list.length,
    // полный список нужен, чтобы разбирать расхождения не вслепую
    all: withRoute.map((t) => ({ code: t.tariff_code, mode: t.delivery_mode, name: t.tariff_name, price: Math.round(t.delivery_sum) })),
    options: [shape(cheapest(toPoint), 'pvz'), shape(cheapest(toDoor), 'courier')].filter(Boolean),
  };
}

/** Пункты выдачи в городе: для карты и выбора адреса получателя. */
export async function deliveryPoints({ cityCode, postal, limit = 200 }) {
  const status = cdekStatus();
  if (!status.ok) throw new Error(`СДЭК не настроен: ${status.reason}`);

  const data = await call('/deliverypoints', {
    query: { city_code: cityCode, postal_code: postal, type: 'PVZ', country_code: 'RU', size: limit },
  });
  const list = Array.isArray(data) ? data : [];
  return list.map((p) => ({
    code: p.code,
    name: p.name,
    address: p.location?.address_full || p.location?.address || '',
    lat: p.location?.latitude,
    lon: p.location?.longitude,
    workTime: p.work_time,
  }));
}

/** Подсказка городов по названию: нужна, чтобы получить код города для ПВЗ. */
export async function findCities(query, limit = 10) {
  const status = cdekStatus();
  if (!status.ok) throw new Error(`СДЭК не настроен: ${status.reason}`);
  const data = await call('/location/cities', { query: { city: query, country_codes: 'RU', size: limit } });
  const list = Array.isArray(data) ? data : [];
  return list.map((c) => ({ code: c.code, city: c.city, region: c.region, postal: c.postal_codes?.[0] }));
}
