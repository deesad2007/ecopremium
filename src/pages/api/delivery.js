// ─────────────────────────────────────────────────────────────
// Расчёт доставки СДЭК для корзины.
//
// Вес и состав считаются на сервере по каталогу: браузер присылает только
// «какой товар и сколько штук», как и в оплате.
//
// Пока СДЭК не настроен (нет ключей), отвечаем 503 и честно говорим, что
// стоимость посчитает менеджер. Сайт при этом работает как раньше.
// ─────────────────────────────────────────────────────────────

import data from '../../data/products.json';
import { deliveryOptions, findCities, cdekStatus } from '../../lib/cdek.js';
import { json, cut, makeRateLimiter } from '../../lib/http.js';

export const prerender = false;

const rateLimited = makeRateLimiter({ max: 30, windowMs: 10 * 60 * 1000 });
const byId = new Map(data.products.map((p) => [String(p.id), p]));

export async function POST({ request, clientAddress }) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20_000) return json({ error: 'Слишком большой запрос' }, 413);

  const status = cdekStatus();
  if (!status.ok) {
    console.error('[delivery] СДЭК не настроен:', status.reason);
    return json({ error: 'Расчёт доставки пока недоступен. Менеджер посчитает стоимость при подтверждении заказа.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (rateLimited(clientAddress)) {
    return json({ error: 'Слишком много запросов подряд. Попробуйте через несколько минут.' }, 429);
  }

  // подсказка городов: нужна, чтобы покупатель выбрал город из списка СДЭКа
  const cityQuery = cut(body.cityQuery, 100);
  if (cityQuery) {
    try {
      return json({ ok: true, cities: await findCities(cityQuery) });
    } catch (err) {
      console.error('[delivery] поиск города:', err);
      return json({ error: 'Не удалось получить список городов' }, 502);
    }
  }

  const toPostal = cut(body.postal, 10).replace(/\D/g, '');
  const toCity = cut(body.city, 100);
  if (!toPostal && !toCity) return json({ error: 'Укажите город или индекс' }, 400);

  const raw = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!raw.length) return json({ error: 'Корзина пуста' }, 400);

  const items = [];
  for (const line of raw) {
    const product = byId.get(String(line.id));
    if (!product) continue;
    items.push({
      qty: Math.min(Math.max(parseInt(line.qty, 10) || 1, 1), 99),
      // вес берётся из каталога, если проставлен у товара или у фасовки
      weight: weightOf(product, line.volume),
    });
  }
  if (!items.length) return json({ error: 'Товары не найдены' }, 400);

  try {
    const result = await deliveryOptions({ toPostal, toCity, items });
    if (!result.options.length) {
      return json({ error: 'СДЭК не нашёл вариантов доставки для этого адреса' }, 404);
    }
    return json({ ok: true, ...result });
  } catch (err) {
    console.error('[delivery] расчёт не удался:', err);
    return json({ error: 'Не удалось рассчитать доставку. Менеджер посчитает её при подтверждении заказа.' }, 502);
  }
}

// Вес в граммах: сначала у выбранной фасовки, потом у товара целиком.
function weightOf(product, volume) {
  const v = (product.variants || []).find((x) => String(x.volume) === String(volume));
  return Number(v?.weight) || Number(product.weight) || null;
}
