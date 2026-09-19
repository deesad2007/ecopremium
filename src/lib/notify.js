// ─────────────────────────────────────────────────────────────
// Доставка заявок и оплат в каналы: amoCRM, Telegram, почта.
// Вынесено из обработчика заявки, потому что этим же пользуется оплата:
// заказ уходит в CRM дважды — при создании счёта и после оплаты.
// Каждый канал необязателен: нет ключей — канал пропускается.
// ─────────────────────────────────────────────────────────────

const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export async function notifyOrder(order, leadTitle, tags = []) {
  const results = await Promise.allSettled([
    sendToAmoCRM(order, leadTitle, tags),
    sendToTelegram(order, leadTitle),
    sendEmail(order, leadTitle),
  ]);

  const channels = ['amocrm', 'telegram', 'email'];
  const report = {};
  results.forEach((r, i) => {
    report[channels[i]] = r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) };
  });
  return report;
}

export const anyDelivered = (report) => Object.values(report).some((r) => r && r.ok);
// Канал считается настроенным, если у него заданы ключи (нет пометки skipped).
export const anyConfigured = (report) => Object.values(report).some((r) => r && !r.skipped);

// ── amoCRM ──
async function sendToAmoCRM(order, leadTitle, tags = []) {
  const { AMOCRM_SUBDOMAIN, AMOCRM_ACCESS_TOKEN } = process.env;
  if (!AMOCRM_SUBDOMAIN || !AMOCRM_ACCESS_TOKEN) return { ok: false, skipped: 'не настроен' };

  // Значения переменных окружения легко испортить при вставке в панель хостинга:
  // лишний пробел, перенос строки или случайная кириллица. В заголовок HTTP такие
  // символы не помещаются, и fetch падает с невнятным TypeError про ByteString.
  // Проверяем заранее и говорим человеческим языком, что именно поправить.
  const token = String(AMOCRM_ACCESS_TOKEN).trim();
  const sub = String(AMOCRM_SUBDOMAIN).trim();
  if (!/^[\x21-\x7E]+$/.test(token)) {
    throw new Error('переменная AMOCRM_ACCESS_TOKEN содержит посторонние символы (пробел, перенос строки или кириллицу) — впишите токен заново');
  }
  if (!/^[a-zA-Z0-9-]+$/.test(sub)) {
    throw new Error('переменная AMOCRM_SUBDOMAIN содержит посторонние символы — должно быть только имя поддомена, например ekopremi1');
  }

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
    order.volume && `Объём: ${order.volume}`,
    order.composition && `Состав: ${order.composition}`,
    order.delivery && `Доставка: ${order.delivery}`,
    order.address && `Адрес: ${order.address}`,
    order.promo && `Промокод: ${order.promo}`,
    order.comment && `Комментарий: ${order.comment}`,
    order.invId && `Счёт Робокассы: ${order.invId}`,
    order.page && `Страница: ${order.page}`,
  ].filter(Boolean).join('\n');

  const lead = {
    name: leadTitle,
    ...(order.price ? { price: order.price } : {}),
    ...(pipelineId ? { pipeline_id: pipelineId } : {}),
    ...(statusId ? { status_id: statusId } : {}),
    _embedded: {
      tags: [{ name: 'сайт' }, { name: 'ekopremium' }, ...tags.map((name) => ({ name }))],
      contacts: [{
        name: order.name,
        ...(contactFields.length ? { custom_fields_values: contactFields } : {}),
      }],
      ...(noteText ? { notes: [{ note_type: 'common', params: { text: noteText } }] } : {}),
    },
  };

  const res = await fetch(`https://${sub}.amocrm.ru/api/v4/leads/complex`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    order.price && `💰 <b>Сумма:</b> ${Number(order.price).toLocaleString('ru-RU')} ₽`,
    order.volume && `🧴 <b>Объём:</b> ${esc(order.volume)}`,
    order.composition && `🛒 <b>Состав:</b> ${esc(order.composition)}`,
    order.delivery && `🚚 <b>Доставка:</b> ${esc(order.delivery)}`,
    order.address && `🏠 <b>Адрес:</b> ${esc(order.address)}`,
    order.promo && `🎟 <b>Промокод:</b> ${esc(order.promo)}`,
    order.comment && `📝 <b>Комментарий:</b> ${esc(order.comment)}`,
    order.invId && `🧾 <b>Счёт:</b> ${esc(order.invId)}`,
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
    ['Сумма', order.price ? `${Number(order.price).toLocaleString('ru-RU')} ₽` : ''],
    ['Объём', order.volume],
    ['Состав', order.composition],
    ['Доставка', order.delivery],
    ['Адрес', order.address],
    ['Промокод', order.promo],
    ['Комментарий', order.comment],
    ['Счёт Робокассы', order.invId],
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
