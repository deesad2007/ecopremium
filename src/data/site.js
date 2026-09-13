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
  // Пока пусто — кнопка MAX на сайте не показывается.
  max: '',
  telegramBot: '@Ecopremi_bot',
  email: 'maslo8540@mail.ru',
  vk: 'https://vk.com/ekopremi',
  freeDeliveryFrom: 10000,
};

// Система накопительных скидок от суммы заказа.
// Пороги и проценты — ЗАГЛУШКА, согласовать с клиентом и поменять здесь.
// Скидка считается по наибольшему достигнутому порогу.
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
