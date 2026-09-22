// ─────────────────────────────────────────────────────────────
// Проверка адреса доставки через геокодер Яндекса.
//
// Зачем: в СДЭК адрес не передаётся вовсе — калькулятор берёт только код
// города. Поэтому опечатка в адресе не вызывает никакой ошибки: оплата
// проходит, а невезучий заказ всплывает уже при отправке посылки.
//
// Ключ живёт только в переменной окружения YANDEX_GEOCODER_KEY. Геокодер
// отвечает лишь на запросы с Referer домена, указанного в ограничениях
// ключа, поэтому заголовок проставляем явно: с сервера его иначе нет.
// ─────────────────────────────────────────────────────────────
import { json, cut, makeRateLimiter } from '../../lib/http.js';

export const prerender = false;

const rateLimited = makeRateLimiter({ max: 40, windowMs: 10 * 60 * 1000 });

// Нормализуем для сравнения. Геокодер возвращает населённый пункт с типом:
// «село Дивеево», «пгт Вача», — а человек пишет просто «Дивеево». Без снятия
// типа любое село считалось бы «другим городом»: на Дивеево это и поймали.
const TYPE = /^(?:г|гор|город|с|село|п|пос|посёлок|поселок|пгт|рп|д|дер|деревня|ст|станица|х|хутор|аул|сл|слобода)\.?\s+/i;
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(TYPE, '').trim();

// «Ростов» и «Ростов-на-Дону» — по сути одно и то же место, поэтому
// считаем города разными, только если ни один не входит в другой.
const sameCity = (a, b) => {
  const x = norm(a), y = norm(b);
  return Boolean(x) && Boolean(y) && (x === y || x.includes(y) || y.includes(x));
};

export async function POST({ request, clientAddress }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const address = cut(body.address, 300);
  const city = cut(body.city, 100);
  if (!address) return json({ ok: true, skipped: true });

  // Нет ключа или слишком частые запросы — проверку пропускаем.
  // Продажу это не должно останавливать ни при каких обстоятельствах.
  const key = process.env.YANDEX_GEOCODER_KEY;
  if (!key) return json({ ok: true, skipped: true, why: 'no_key' });
  if (rateLimited(clientAddress)) return json({ ok: true, skipped: true, why: 'rate' });

  const query = city && !norm(address).includes(norm(city)) ? `${city}, ${address}` : address;

  const url = new URL('https://geocode-maps.yandex.ru/1.x/');
  url.searchParams.set('apikey', key);
  url.searchParams.set('format', 'json');
  url.searchParams.set('results', '1');
  url.searchParams.set('geocode', query);

  let data;
  try {
    const res = await fetch(url, {
      headers: { Referer: 'https://ekopremium.ru/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return json({ ok: true, skipped: true, why: 'geocoder_' + res.status });
    data = await res.json();
  } catch {
    return json({ ok: true, skipped: true, why: 'geocoder_down' });
  }

  const found = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  if (!found) return json({ ok: false, reason: 'not_found' });

  const meta = found.metaDataProperty?.GeocoderMetaData || {};
  const precision = meta.precision || 'other';
  const formatted = meta.text || meta.Address?.formatted || '';
  const parts = meta.Address?.Components || [];
  const foundCity = parts.filter((c) => c.kind === 'locality').map((c) => c.name).pop() || '';

  // Геокодер охотно отвечает и на бессмыслицу: «адрес мой дом» он нашёл
  // как жилой комплекс в Петрозаводске. Поэтому мало точности до дома —
  // адрес обязан оказаться в том же городе, куда человек заказывает.
  if (city && foundCity && !sameCity(foundCity, city)) {
    return json({ ok: false, reason: 'other_city', formatted, foundCity, precision });
  }
  if (precision !== 'exact' && precision !== 'number') {
    return json({ ok: false, reason: 'no_house', formatted, precision });
  }
  return json({ ok: true, formatted, precision });
}
