// ─────────────────────────────────────────────────────────────
// Проверка промокода для кнопки «Активировать» в форме заказа.
//
// Отдаёт только процент, ничего больше. Настоящая скидка всё равно
// считается заново при выставлении счёта в /api/pay: этому ответу
// браузер доверять не обязан, он нужен лишь чтобы показать человеку,
// что код принят.
// ─────────────────────────────────────────────────────────────

import { promoPercent } from '../../data/promo.js';
import { json, cut, makeRateLimiter } from '../../lib/http.js';

export const prerender = false;

// Промокоды короткие, поэтому перебор ограничиваем жёстче обычного.
const rateLimited = makeRateLimiter({ max: 20, windowMs: 10 * 60 * 1000 });

export async function POST({ request, clientAddress }) {
  if (rateLimited(clientAddress)) {
    return json({ error: 'Слишком много попыток. Попробуйте через несколько минут.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const code = cut(body.code, 60);
  if (!code) return json({ error: 'Введите промокод' }, 400);

  const percent = promoPercent(code);
  if (!percent) {
    return json({ ok: false, percent: 0, message: 'Такого промокода нет. Проверьте написание.' });
  }

  return json({ ok: true, percent, message: `Промокод принят: скидка ${percent}%.` });
}
