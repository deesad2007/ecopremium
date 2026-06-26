// ─────────────────────────────────────────────────────────────
// EcoPremium — обработчик заявки с сайта.
// Один вход → параллельно: (1) amoCRM lead+contact, (2) Telegram, (3) email.
// Все секреты только в переменных окружения Netlify (см. .env.example).
// Каждый канал необязателен: если ключи не заданы — канал пропускается,
// заявка уходит в остальные. Если amoCRM упал — Telegram и email всё равно сработают,
// чтобы лид не потерялся.
// ─────────────────────────────────────────────────────────────

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  // honeypot — молча принимаем, ничего не делаем
  if (data.company) return json(200, { ok: true });

  const name = (data.name || '').trim();
  const phone = (data.phone || '').trim();
  if (!name || !phone) return json(400, { error: 'Имя и телефон обязательны' });

  const order = {
    name,
    phone,
    email: (data.email || '').trim(),
    product: (data.product || '').trim(),
    price: Number(data.price) || 0,
    composition: (data.composition || '').trim(),
    delivery: (data.delivery || '').trim(),
    promo: (data.promo || '').trim(),
    comment: (data.comment || '').trim(),
    page: (data.page || '').trim(),
    at: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
  };

  const leadTitle = order.product
    ? `Заявка с сайта — ${order.product}`
    : 'Заявка с сайта — обратная связь';

  // запускаем все каналы параллельно, ни один сбой не валит остальные
  const results = await Promise.allSettled([
    sendToAmoCRM(order, leadTitle),
    sendToTelegram(order, leadTitle),
    sendEmail(order, leadTitle),
  ]);

  const channels = ['amocrm', 'telegram', 'email'];
  const report = {};
  results.forEach((r, i) => {
    report[channels[i]] = r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) };
  });

  const anyDelivered = Object.values(report).some((r) => r && r.ok);
  // Для показа на бесплатном поддомене без ключей считаем заявку принятой,
  // даже если каналы не настроены (skipped) — лид логируется в Netlify Functions log.
  if (!anyDelivered) {
    console.log('[order] заявка получена, активных каналов нет (демо-режим):', JSON.stringify(order));
  }

  return json(200, { ok: true, channels: report });
};

// ── amoCRM ──
async function sendToAmoCRM(order, leadTitle) {
  const { AMOCRM_SUBDOMAIN, AMOCRM_ACCESS_TOKEN } = process.env;
  if (!AMOCRM_SUBDOMAIN || !AMOCRM_ACCESS_TOKEN) return { ok: false, skipped: 'не настроен' };

  const pipelineId = Number(process.env.AMOCRM_PIPELINE_ID) || undefined;
  const statusId = Number(process.env.AMOCRM_STATUS_ID) || undefined;
  const phoneFieldId = Number(process.env.AMOCRM_PHONE_FIELD_ID) || undefined;
  const emailFieldId = Number(process.env.AMOCRM_EMAIL_FIELD_ID) || undefined;

  const contactFields = [];
  if (phoneFieldId && order.phone) {
    contactFields.push({ field_id: phoneFieldId, values: [{ value: order.phone, enum_code: 'WORK' }] });
  }
  if (emailFieldId && order.email) {
    contactFields.push({ field_id: emailFieldId, values: [{ value: order.email, enum_code: 'WORK' }] });
  }

  const noteText = [
    order.composition && `Состав: ${order.composition}`,
    order.delivery && `Доставка: ${order.delivery}`,
    order.promo && `Промокод: ${order.promo}`,
    order.comment && `Комментарий: ${order.comment}`,
    order.page && `Страница: ${order.page}`,
  ].filter(Boolean).join('\n');

  const lead = {
    name: leadTitle,
    ...(order.price ? { price: order.price } : {}),
    ...(pipelineId ? { pipeline_id: pipelineId } : {}),
    ...(statusId ? { status_id: statusId } : {}),
    _embedded: {
      tags: [{ name: 'сайт' }, { name: 'ekopremium' }],
      contacts: [{
        name: order.name,
        ...(contactFields.length ? { custom_fields_values: contactFields } : {}),
      }],
      ...(noteText ? { notes: [{ note_type: 'common', params: { text: noteText } }] } : {}),
    },
  };

  const res = await fetch(`https://${AMOCRM_SUBDOMAIN}.amocrm.ru/api/v4/leads/complex`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AMOCRM_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([lead]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`amoCRM ${res.status}: ${text.slice(0, 300)}`);
  }
  return { ok: true };
}

// ── Telegram ──
async function sendToTelegram(order, leadTitle) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return { ok: false, skipped: 'не настроен' };

  const lines = [
    `🫒 <b>${esc(leadTitle)}</b>`,
    '',
    `👤 <b>Имя:</b> ${esc(order.name)}`,
    `📞 <b>Телефон:</b> ${esc(order.phone)}`,
    order.email && `✉️ <b>Email:</b> ${esc(order.email)}`,
    order.price && `💰 <b>Сумма:</b> ${order.price.toLocaleString('ru-RU')} ₽`,
    order.composition && `🛒 <b>Состав:</b> ${esc(order.composition)}`,
    order.delivery && `🚚 <b>Доставка:</b> ${esc(order.delivery)}`,
    order.promo && `🎟 <b>Промокод:</b> ${esc(order.promo)}`,
    order.comment && `📝 <b>Комментарий:</b> ${esc(order.comment)}`,
    '',
    `🕒 ${esc(order.at)} · ${esc(order.page)}`,
  ].filter(Boolean).join('\n');

  const chatIds = TELEGRAM_CHAT_ID.split(',').map((s) => s.trim()).filter(Boolean);
  for (const chatId of chatIds) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Telegram ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  return { ok: true };
}

// ── Email (SMTP через nodemailer) ──
async function sendEmail(order, leadTitle) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, ORDER_EMAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ORDER_EMAIL_TO) return { ok: false, skipped: 'не настроен' };

  // импорт внутри функции, чтобы отсутствие пакета не ломало остальные каналы
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const rows = [
    ['Имя', order.name],
    ['Телефон', order.phone],
    ['Email', order.email],
    ['Сумма', order.price ? `${order.price.toLocaleString('ru-RU')} ₽` : ''],
    ['Состав', order.composition],
    ['Доставка', order.delivery],
    ['Промокод', order.promo],
    ['Комментарий', order.comment],
    ['Страница', order.page],
    ['Время', order.at],
  ].filter(([, v]) => v);

  const html = `
    <h2 style="font-family:Georgia,serif;color:#222a1a">${esc(leadTitle)}</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:6px 14px 6px 0;color:#7b7c6a">${esc(k)}</td>
        <td style="padding:6px 0;color:#2b2e24"><b>${esc(v)}</b></td></tr>`).join('')}
    </table>
    <p style="color:#9a9a8a;font-size:12px;margin-top:18px">Заявка с сайта EcoPremi</p>`;

  await transporter.sendMail({
    from: process.env.ORDER_EMAIL_FROM || SMTP_USER,
    to: ORDER_EMAIL_TO,
    replyTo: order.email || undefined,
    subject: leadTitle,
    html,
  });
  return { ok: true };
}
