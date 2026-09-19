// ─────────────────────────────────────────────────────────────
// ResultURL: Робокасса сообщает сюда об успешной оплате.
// Этот адрес прописывается в кабинете Робокассы, раздел «Технические настройки»:
//   Result URL:  https://ekopremium.ru/api/robokassa-result   (метод POST)
//   Success URL: https://ekopremium.ru/pay/success
//   Fail URL:    https://ekopremium.ru/pay/fail
//
// Единственная настоящая проверка — подпись паролем №2. Отвечать нужно строкой
// OK с номером счёта, иначе Робокасса будет повторять уведомление.
// ─────────────────────────────────────────────────────────────

import { verifyResult, ROBOKASSA_IPS } from '../../lib/robokassa.js';
import { notifyOrder } from '../../lib/notify.js';

export const prerender = false;

const text = (s, status = 200) =>
  new Response(s, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

async function readParams(request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    if (form) for (const [k, v] of form) params[k] = String(v);
  }
  return params;
}

async function handle(request, clientAddress) {
  const params = await readParams(request);
  const { OutSum, InvId } = params;

  if (!verifyResult(params)) {
    console.error('[robokassa] неверная подпись уведомления:', JSON.stringify({ OutSum, InvId, ip: clientAddress }));
    return text('bad sign', 403);
  }

  // Адрес отправителя пишем в лог для разбора инцидентов, но не блокируем по нему:
  // список адресов Робокассы может меняться, а подпись уже проверена.
  if (clientAddress && !ROBOKASSA_IPS.includes(clientAddress)) {
    console.warn('[robokassa] уведомление с неожиданного адреса:', clientAddress);
  }

  const order = {
    name: 'Оплата картой',
    phone: '',
    price: Number(OutSum) || 0,
    invId: InvId,
    comment: 'Оплата подтверждена Робокассой. Заявка с этим же номером счёта уже есть в CRM.',
    at: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
  };

  const report = await notifyOrder(order, `Оплачен счёт ${InvId} — ${order.price.toLocaleString('ru-RU')} ₽`, ['оплачено']);
  console.log('[robokassa] оплата принята', InvId, JSON.stringify(report));

  // Робокасса ждёт ровно такой ответ, иначе будет слать уведомление повторно.
  return text(`OK${InvId}`);
}

export async function POST({ request, clientAddress }) {
  return handle(request, clientAddress);
}

export async function GET({ request, clientAddress }) {
  return handle(request, clientAddress);
}
