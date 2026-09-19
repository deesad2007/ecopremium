// ─────────────────────────────────────────────────────────────
// Создание счёта в Робокассе и ссылки на оплату.
//
// Цены берутся ТОЛЬКО из каталога на сервере: то, что прислал браузер,
// используется лишь как «какой товар и сколько штук». Иначе сумму можно
// было бы подменить в консоли браузера.
//
// Заказ уходит в CRM сразу, с пометкой «ожидает оплаты»: если покупатель
// бросит оплату на полпути, менеджер всё равно увидит заявку и перезвонит.
// ─────────────────────────────────────────────────────────────

import data from '../../data/products.json';
import { newInvId, paymentUrl, robokassaStatus } from '../../lib/robokassa.js';
import { notifyOrder } from '../../lib/notify.js';
import { json, cut, makeRateLimiter } from '../../lib/http.js';

export const prerender = false;

const rateLimited = makeRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

// id → товар, собирается один раз при старте
const byId = new Map(data.products.map((p) => [String(p.id), p]));

function priceOf(product, volume) {
  const variants = product.variants || [];
  if (!variants.length) return product.price != null ? { price: Number(product.price), volume: '' } : null;
  const found = volume ? variants.find((v) => String(v.volume) === String(volume)) : variants[0];
  const v = found || variants[0];
  return v && v.price != null ? { price: Number(v.price), volume: String(v.volume || '') } : null;
}

export async function POST({ request, clientAddress }) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20_000) return json({ error: 'Слишком большой запрос' }, 413);

  const status = robokassaStatus();
  if (!status.ok) {
    console.error('[pay] Робокасса не настроена:', status.reason);
    return json({ error: 'Оплата картой сейчас недоступна. Оформите заявку, и менеджер пришлёт счёт.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (body.company) return json({ ok: true }); // honeypot
  if (rateLimited(clientAddress)) {
    return json({ error: 'Слишком много попыток подряд. Попробуйте через несколько минут.' }, 429);
  }

  const name = cut(body.name, 100);
  const phone = cut(body.phone, 30);
  const email = cut(body.email, 120);
  const address = cut(body.address, 300);
  if (!name || !phone) return json({ error: 'Имя и телефон обязательны' }, 400);

  const raw = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!raw.length) return json({ error: 'Корзина пуста' }, 400);

  const items = [];
  const skipped = [];
  for (const line of raw) {
    const product = byId.get(String(line.id));
    if (!product) continue;
    const p = priceOf(product, line.volume);
    if (!p) { skipped.push(product.name); continue; }
    const qty = Math.min(Math.max(parseInt(line.qty, 10) || 1, 1), 99);
    items.push({
      name: p.volume ? `${product.name}, ${p.volume}` : product.name,
      price: p.price,
      qty,
      // если у товара в каталоге проставлена своя ставка НДС — она победит общую
      ...(product.vat ? { vat: product.vat } : {}),
    });
  }

  if (!items.length) {
    return json({
      error: 'У выбранных товаров нет цены на сайте. Оформите заявку, менеджер посчитает стоимость.',
      skipped,
    }, 400);
  }

  const invId = newInvId();
  let pay;
  try {
    pay = paymentUrl({
      invId,
      items,
      description: `Заказ ${invId} на ekopremium.ru`,
      email,
    });
  } catch (err) {
    console.error('[pay] не удалось собрать ссылку:', err);
    return json({ error: 'Не удалось создать счёт. Оформите заявку, и менеджер пришлёт счёт вручную.' }, 502);
  }

  const order = {
    name,
    phone,
    email,
    address,
    delivery: cut(body.delivery, 80),
    comment: cut(body.comment, 2000),
    composition: items.map((i) => `${i.name} × ${i.qty}`).join('; '),
    price: Number(pay.outSum),
    invId,
    page: cut(body.page, 200),
    at: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
  };

  // Не ждём CRM дольше необходимого: покупателя нельзя держать перед оплатой.
  // Ошибку канала логируем, но ссылку на оплату всё равно отдаём.
  notifyOrder(order, `Счёт ${invId} — ожидает оплаты`, ['ожидает оплаты'])
    .then((report) => console.log('[pay] счёт создан', invId, JSON.stringify(report)))
    .catch((err) => console.error('[pay] каналы не приняли счёт', invId, err));

  return json({ ok: true, url: pay.url, invId, sum: pay.outSum, skipped });
}
