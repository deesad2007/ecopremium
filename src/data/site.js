// Сквозные данные сайта: контакты и счётчики аналитики.
export const contacts = {
  phone: '+7 996-005-6765',
  phoneRaw: '+79960056765',
  phone2: '+7 916-414-0392',
  phone2Raw: '+79164140392',
  whatsapp: 'https://wa.me/79960056765',
  whatsappRaw: '79960056765',
  telegram: 'https://t.me/EkoPremi',
  // MAX: ссылок «написать по номеру» (как wa.me) у мессенджера нет — нужна ссылка
  // на профиль вида https://max.ru/u/<хеш> (в приложении: аватар → QR → «Поделиться»).
  max: 'https://max.ru/u/f9LHodD0cOIx-lnQXUjsaXOKeNVD4W-r9Y-fEhDOKWKu4CB3uUnFngi2a8w',
  telegramBot: '@Ecopremi_bot',
  email: 'maslo8540@mail.ru',
  vk: 'https://vk.com/ekopremi',
  freeDeliveryFrom: 10000,
};

// Система накопительных скидок от суммы заказа.
// Пороги и проценты — ЗАГЛУШКА, согласовать с клиентом и поменять здесь.
// Скидка считается по наибольшему достигнутому порогу.
// Продавец один — ООО «ПОКРОВ». На него же оформлена Робокасса, поэтому
// продавец на сайте, в оферте и в чеке совпадают: это ровно то, что проверяет
// модерация платёжной системы.
// Масла и жмых производит Науршин Е. Ф., но продаёт их ООО, поэтому как
// продавца его на сайте не указываем.
// Банковские реквизиты намеренно не публикуются: платёжные системы их не требуют,
// а открытый расчётный счёт — риск мошеннических «оплат».

export const company = {
  legalName: 'ООО «ПОКРОВ»',
  shortName: 'ООО «ПОКРОВ»',
  fullName: 'Общество с ограниченной ответственностью «ПОКРОВ»',
  inn: '5254495412',
  kpp: '525401001',
  ogrn: '1215200029550',
  region: '607320, Нижегородская обл., Дивеевский р-н, с. Дивеево, ул. Юности, д. 32',
  director: 'генеральный директор Гребенщиков Иван Евгеньевич',
  sells: 'масла холодного отжима, жмых, мука, крупы, зерно, орехи и семена, мёд, хлеб, печенье',
  payment: 'Товары с ценой можно оплатить картой на сайте, остальные оформляются заявкой.',
};

export const seller = company;
export const sellers = [company];

// Продавец у всех товаров один. Функция оставлена, чтобы карточка товара
// не знала о структуре данных: если продавцов снова станет двое, правим только здесь.
export function sellerFor() {
  return company;
}

// Строки реквизитов для вывода: пустые поля пропускаются.
export function sellerLines(s) {
  const out = [];
  if (s.ogrn) out.push(`ОГРН ${s.ogrn}`);
  if (s.status) out.push(s.status);
  if (s.inn) out.push(`ИНН ${s.inn}${s.kpp ? `, КПП ${s.kpp}` : ''}`);
  if (s.region) out.push(s.region);
  return out;
}

export const discounts = [
  { from: 5000, percent: 5 },
  { from: 10000, percent: 10 },
  { from: 20000, percent: 15 },
];

// Счётчики перенесены с текущего сайта ekopremium.ru
export const analytics = {
  yandexMetrika: '99571167',
  topMailRu: '3605421',
};

// Видео-отзывы покупателей со старого сайта. Ролики на Rutube, обложки сохранены у нас.
export const videoReviews = [
  { id: 'f23b4d5a86ba747c1f50395a349ea7c0', title: 'Отзыв Ирины', duration: '1:35', thumb: '/img/review-irina.webp' },
  { id: 'ce4c1338bd153033e2e654ef70343eee', title: 'Отзыв Екатерины', duration: '1:39', thumb: '/img/review-ekaterina.webp' },
  { id: 'aa1d7e66599bf195d527900bed5327cd', title: 'Отзыв Надежды', duration: '1:43', thumb: '/img/review-nadezhda.webp' },
];
