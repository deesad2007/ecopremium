// ─────────────────────────────────────────────────────────────
// Робокасса: сборка ссылки на оплату и проверка уведомления.
// Продавец — ООО «ПОКРОВ», касса и чеки на стороне Робокассы.
//
// Секреты только в переменных окружения хостинга:
//   ROBOKASSA_LOGIN    — идентификатор магазина
//   ROBOKASSA_PASS1    — пароль №1, им подписывается запрос на оплату
//   ROBOKASSA_PASS2    — пароль №2, им проверяется уведомление об оплате
//   ROBOKASSA_SNO      — система налогообложения для чека (необязательна:
//                        без неё берётся та, что указана в кабинете Робокассы)
//   ROBOKASSA_VAT      — ставка НДС для позиций чека
//   ROBOKASSA_IS_TEST  — 1, пока идёт тестирование
//
// Документация: https://docs.robokassa.ru/pay-interface/
// ─────────────────────────────────────────────────────────────

import crypto from 'node:crypto';

const PAY_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

// Допустимые значения берём из документации, чтобы опечатка в панели хостинга
// не превратилась в чек с неверной системой налогообложения.
const SNO = ['osn', 'usn_income', 'usn_income_outcome', 'esn', 'patent'];
// Полный актуальный список из документации Робокассы (раздел «Фискализация»).
// С 2026 года основная ставка 22%, поэтому vat22 и vat122 обязательны в списке.
const VAT = ['none', 'vat0', 'vat5', 'vat7', 'vat10', 'vat20', 'vat22',
             'vat105', 'vat107', 'vat110', 'vat120', 'vat122'];

export function robokassaStatus() {
  const { ROBOKASSA_LOGIN, ROBOKASSA_PASS1, ROBOKASSA_PASS2, ROBOKASSA_SNO, ROBOKASSA_VAT } = process.env;
  if (!ROBOKASSA_LOGIN || !ROBOKASSA_PASS1 || !ROBOKASSA_PASS2) {
    return { ok: false, reason: 'не заданы ROBOKASSA_LOGIN, ROBOKASSA_PASS1 и ROBOKASSA_PASS2' };
  }
  // Система налогообложения необязательна: если её не передать, Робокасса подставит
  // ту, что указана в личном кабинете магазина. Проверяем, только если задана,
  // чтобы опечатка не уехала в чек.
  if (ROBOKASSA_SNO && !SNO.includes(String(ROBOKASSA_SNO))) {
    return { ok: false, reason: `ROBOKASSA_SNO должна быть пустой или одной из: ${SNO.join(', ')}` };
  }
  if (!VAT.includes(String(ROBOKASSA_VAT))) {
    return { ok: false, reason: `ROBOKASSA_VAT должна быть одной из: ${VAT.join(', ')}` };
  }
  return { ok: true };
}

// Номер счёта. Без базы данных берём секунды эпохи: число растёт, влезает
// в int32 и уникально в пределах секунды — этого достаточно для одного магазина.
export function newInvId() {
  return Math.floor(Date.now() / 1000);
}

const money = (n) => Number(n).toFixed(2);

function buildReceipt(items) {
  return {
    // Пустую СНО не передаём вовсе: пусть действует значение из кабинета Робокассы.
    ...(process.env.ROBOKASSA_SNO ? { sno: process.env.ROBOKASSA_SNO } : {}),
    items: items.map((i) => ({
      name: String(i.name).slice(0, 128),
      quantity: Number(i.qty) || 1,
      sum: Number(money((Number(i.price) || 0) * (Number(i.qty) || 1))),
      payment_method: 'full_payment',
      // Товар или услуга: доставка в чеке обязана быть услугой, а не товаром.
      payment_object: i.object || 'commodity',
      // Ставка НДС берётся из товара, если она там задана, иначе общая из переменной.
      // На общей системе налогообложения у продуктов ставки разные: хлеб, мука, крупы
      // и растительное масло идут по 10%, часть позиций по 20%. Пока у товаров ставка
      // не проставлена, действует общая — её подтверждает бухгалтер.
      tax: i.vat || process.env.ROBOKASSA_VAT,
    })),
  };
}

/**
 * Ссылка на оплату. Сумма считается по составу чека, а не приходит с фронта:
 * иначе цену можно было бы подменить в браузере.
 */
export function paymentUrl({ invId, items, description, email }) {
  const status = robokassaStatus();
  if (!status.ok) throw new Error(`Робокасса не настроена: ${status.reason}`);

  const badVat = items.find((i) => i.vat && !VAT.includes(String(i.vat)));
  if (badVat) throw new Error(`у товара «${badVat.name}» неверная ставка НДС: ${badVat.vat}`);

  const receipt = buildReceipt(items);
  const outSum = money(receipt.items.reduce((s, i) => s + i.sum, 0));
  if (Number(outSum) <= 0) throw new Error('Сумма заказа равна нулю');

  // Документация Робокассы противоречит сама себе. Раздел «Сборка подписи»:
  // «Receipt — фискальные данные в минимизированном JSON UTF-8». Раздел
  // «Фискализация»: «перед добавлением в строку для подписи значение Receipt
  // нужно URL-кодировать». Первый вариант описывает саму подпись, поэтому он
  // по умолчанию; второй остаётся переключателем ROBOKASSA_RECEIPT_SIGN=encoded
  // на случай, если магазин настроен иначе.
  // В самом запросе Receipt всегда уходит закодированным: этим занимается
  // URLSearchParams, и к подписи это отношения не имеет.
  const receiptRaw = JSON.stringify(receipt);
  const receiptForSign = String(process.env.ROBOKASSA_RECEIPT_SIGN || 'raw') === 'encoded'
    ? encodeURIComponent(receiptRaw)
    : receiptRaw;
  const signature = md5([
    process.env.ROBOKASSA_LOGIN,
    outSum,
    invId,
    receiptForSign,
    process.env.ROBOKASSA_PASS1,
  ].join(':'));

  const params = new URLSearchParams({
    MerchantLogin: process.env.ROBOKASSA_LOGIN,
    OutSum: outSum,
    InvId: String(invId),
    Description: String(description || 'Заказ на сайте ekopremium.ru').slice(0, 100),
    Receipt: receiptRaw,
    SignatureValue: signature,
    Culture: 'ru',
    Encoding: 'utf-8',
  });
  if (email) params.set('Email', email);
  if (String(process.env.ROBOKASSA_IS_TEST) === '1') params.set('IsTest', '1');

  return { url: `${PAY_URL}?${params.toString()}`, outSum };
}

/**
 * Проверка уведомления на ResultURL. Подпись считается паролем №2.
 * Возвращает true только если контрольные суммы совпали.
 */
export function verifyResult({ OutSum, InvId, SignatureValue }) {
  if (!OutSum || !InvId || !SignatureValue) return false;
  const expected = md5(`${OutSum}:${InvId}:${process.env.ROBOKASSA_PASS2}`);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(SignatureValue).toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Адреса, с которых Робокасса шлёт уведомления. Используем только для записи
// в лог: настоящая защита — подпись, а список адресов у них может меняться.
export const ROBOKASSA_IPS = ['185.59.216.65', '185.59.217.65'];
