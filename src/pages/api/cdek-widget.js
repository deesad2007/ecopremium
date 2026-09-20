// ─────────────────────────────────────────────────────────────
// Серверная часть виджета ПВЗ от СДЭК.
//
// Виджет (cdn.jsdelivr.net/npm/@cdek-it/widget@3) сам обращается к адресу,
// который указан у него в параметре servicePath. Контракт взят из исходников
// виджета, а не из догадок:
//
//   GET  ?action=offices&page=&size=&<фильтры>  → массив ПВЗ как его отдаёт СДЭК
//   POST {action:'calculate', from_location, to_location, packages, ...}
//                                              → объект с полем tariff_codes
//
// В обоих случаях мы просто проксируем запрос в СДЭК со своими ключами.
// Готовый service.php от СДЭКа нам не подходит: он на PHP, а у нас Node.
//
// Ключи остаются на сервере и в браузер не попадают.
// ─────────────────────────────────────────────────────────────

import { cdekCall, cdekStatus } from '../../lib/cdek.js';
import { json, makeRateLimiter } from '../../lib/http.js';

export const prerender = false;

const rateLimited = makeRateLimiter({ max: 120, windowMs: 10 * 60 * 1000 });

// Пропускаем только те параметры, которые понимает СДЭК: чужие не передаём,
// чтобы из браузера нельзя было дописать что-то лишнее в запрос к их API.
const OFFICE_PARAMS = new Set([
  'city_code', 'postal_code', 'country_code', 'region_code', 'code', 'type',
  'have_cashless', 'have_cash', 'is_dressing_room', 'allowed_cod', 'weight_max',
  'lang', 'take_only', 'is_handout', 'is_reception', 'fias_guid', 'page', 'size',
]);

export async function GET({ request, clientAddress }) {
  const status = cdekStatus();
  if (!status.ok) return json({ error: 'СДЭК не настроен' }, 503);
  if (rateLimited(clientAddress)) return json({ error: 'Слишком много запросов' }, 429);

  const url = new URL(request.url);
  if (url.searchParams.get('action') !== 'offices') {
    return json({ error: 'Неизвестное действие' }, 400);
  }

  const query = {};
  for (const [k, v] of url.searchParams) {
    if (OFFICE_PARAMS.has(k) && v !== '' && v != null) query[k] = v;
  }
  if (!query.country_code) query.country_code = 'RU';

  try {
    const data = await cdekCall('/deliverypoints', { query });
    return json(data);
  } catch (err) {
    console.error('[widget] список ПВЗ:', err);
    return json({ error: 'Не удалось получить пункты выдачи' }, 502);
  }
}

export async function POST({ request, clientAddress }) {
  const status = cdekStatus();
  if (!status.ok) return json({ error: 'СДЭК не настроен' }, 503);
  if (rateLimited(clientAddress)) return json({ error: 'Слишком много запросов' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (body.action !== 'calculate') return json({ error: 'Неизвестное действие' }, 400);

  // Отправителя берём из своих настроек, а не из браузера: иначе цену доставки
  // можно было бы занизить, подменив город отправления.
  const from = process.env.CDEK_FROM_CODE
    ? { code: Number(process.env.CDEK_FROM_CODE) }
    : { postal_code: String(process.env.CDEK_FROM_POSTAL || '117405') };

  const payload = {
    type: 1,
    currency: body.currency,
    lang: body.lang,
    from_location: from,
    to_location: body.to_location,
    packages: Array.isArray(body.packages) ? body.packages.slice(0, 20) : [],
  };

  try {
    const data = await cdekCall('/calculator/tarifflist', { method: 'POST', body: payload });
    return json(data);
  } catch (err) {
    console.error('[widget] расчёт тарифов:', err);
    return json({ error: 'Не удалось рассчитать доставку' }, 502);
  }
}
