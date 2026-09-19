// ─────────────────────────────────────────────────────────────
// EcoPremium — обработчик заявки с сайта (нативный Astro API route).
// Один вход → параллельно amoCRM, Telegram и почта, см. src/lib/notify.js.
// Каждый канал необязателен: нет ключей — канал пропускается, заявка уходит
// в остальные. Все секреты только в переменных окружения (см. .env.example).
//
// Оплата картой живёт отдельно, в /api/pay: там сумма считается по каталогу,
// а не по тому, что прислал браузер.
// ─────────────────────────────────────────────────────────────

import { notifyOrder, anyDelivered, anyConfigured } from '../../lib/notify.js';
import { json, cut, makeRateLimiter } from '../../lib/http.js';

export const prerender = false;

const rateLimited = makeRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST({ request, clientAddress }) {
  // тело заявки не может быть большим — режем гигантские payload сразу
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20_000) return json({ error: 'Слишком большой запрос' }, 413);

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // honeypot — молча принимаем, ничего не делаем
  if (data.company) return json({ ok: true });

  if (rateLimited(clientAddress)) {
    return json({ error: 'Слишком много заявок подряд. Попробуйте через несколько минут.' }, 429);
  }

  const name = cut(data.name, 100);
  const phone = cut(data.phone, 30);
  if (!name || !phone) return json({ error: 'Имя и телефон обязательны' }, 400);

  const order = {
    name,
    phone,
    email: cut(data.email, 120),
    product: cut(data.product, 200),
    price: Number(data.price) || 0,
    volume: cut(data.volume, 40),
    composition: cut(data.composition, 2000),
    delivery: cut(data.delivery, 80),
    address: cut(data.address, 300),
    promo: cut(data.promo, 60),
    comment: cut(data.comment, 2000),
    page: cut(data.page, 200),
    at: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
  };

  const leadTitle = order.product
    ? `Заявка с сайта — ${order.product}`
    : 'Заявка с сайта — обратная связь';

  const report = await notifyOrder(order, leadTitle);

  if (!anyDelivered(report) && anyConfigured(report)) {
    // Каналы настроены, но ни один не принял заявку. Раньше мы в этом случае
    // отвечали «успешно», и заказ пропадал молча. Теперь честно сообщаем об ошибке:
    // покупатель увидит запасные контакты, а не ложное подтверждение.
    console.error('[order] ни один канал не принял заявку:', JSON.stringify(report), JSON.stringify(order));
    return json({ error: 'Не удалось передать заявку. Напишите нам, пожалуйста, в мессенджер.', channels: report }, 502);
  }

  if (!anyDelivered(report)) {
    console.log('[order] заявка получена, активных каналов нет (демо-режим):', JSON.stringify(order));
  }

  return json({ ok: true, channels: report });
}
