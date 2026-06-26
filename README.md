# EcoPremium — интернет-магазин сыродавленных масел

Многостраничный магазин на **Astro + чистый CSS**. Каталог из `products.json`, заявки через
serverless-функцию Netlify (amoCRM + Telegram + email). Дизайн и палитра — из концепта `ecopremium_v2`.

## Стек
- **Astro 4** (статическая генерация), без UI-фреймворков.
- Чистый CSS — `src/styles/global.css` (палитра forest/olive/gold/bone, serif-заголовки).
- Каталог — `src/data/products.json`.
- Форма заказа — `netlify/functions/order.js` (одна функция на три канала).
- Хостинг — Netlify (бесплатный поддомен → потом домен `ekopremium.ru`).

## Структура
```
src/
  data/products.json   # каталог (добавлять позиции по шаблону)
  data/site.js         # контакты + id счётчиков аналитики
  layouts/Base.astro   # шапка, футер, модалка заказа, аналитика
  components/           # Header, Footer, ProductCard, OrderModal, Regalia, ...
  pages/
    index.astro            # Главная
    catalog.astro          # Каталог с фильтром по типу
    product/[id].astro     # Карточка товара
    about.astro            # Технология + сертификаты + FAQ
    delivery.astro         # Доставка и оплата
    contacts.astro         # Контакты
netlify/functions/order.js # обработчик заявки
```

## Локальный запуск
```bash
npm install
npm run dev          # http://localhost:4321 — сайт (без serverless-функции)
```

Чтобы протестировать форму заказа локально вместе с функцией:
```bash
npm install -g netlify-cli   # один раз
netlify dev                  # поднимает сайт + функции, форма реально отрабатывает
```
Скопируйте `.env.example` → `.env` и заполните ключи (можно частично — незаданные каналы пропускаются).

## Деплой на Netlify (бесплатный поддомен для показа)
1. Залить репозиторий на GitHub.
2. Netlify → **Add new site → Import from Git** → выбрать репозиторий.
   Build настройки берутся из `netlify.toml` автоматически (`npm run build`, publish `dist`).
3. Netlify → **Site settings → Environment variables** — добавить ключи из `.env.example`
   (можно начать без них: форма всё равно принимает заявку, лид пишется в Functions log).
4. **Site settings → Domain → Options → Edit site name** — задать поддомен, напр. `ekopremium` →
   сайт откроется на `https://ekopremium.netlify.app` (ссылка для показа клиенту).
5. После согласования: **Domain → Add custom domain** → `ekopremium.ru` (нужен доступ к DNS клиента).

## Переменные окружения
Полный список с пояснениями — в `.env.example`. Кратко:
- **amoCRM:** `AMOCRM_SUBDOMAIN`, `AMOCRM_ACCESS_TOKEN`, опц. `AMOCRM_PIPELINE_ID`,
  `AMOCRM_STATUS_ID`, `AMOCRM_PHONE_FIELD_ID`, `AMOCRM_EMAIL_FIELD_ID`.
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (бот `@Ecopremi_bot`).
- **Email (SMTP):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ORDER_EMAIL_FROM`, `ORDER_EMAIL_TO`.

**Секреты в коде не хранятся.** Доступы вводит клиент или вы с его явного разрешения.
Если amoCRM недоступен — заявка всё равно уходит в Telegram и на email (каналы независимы).

## Каталог
Добавление товара — новый объект в `products.json` → `products[]`:
```json
{
  "id": "005",
  "name": "Название Премиум+",
  "category": "Масла",
  "art": "t1",                 // t1 лён / t2 тыква / t3 конопля — рисунок-плейсхолдер
  "price": 0,
  "oldPrice": 0,
  "image": "",                 // путь к фото, напр. /img/maslo-...jpg; пусто = SVG-плейсхолдер
  "short": "Короткое описание для карточки.",
  "description": "Полное описание. Только вкус, состав, применение, способ отжима.",
  "badges": ["Органик ГОСТ", "Ручной отжим"]
}
```
Фото класть в `public/img/` и прописывать путь в `image`. Ожидаемые имена для текущих позиций:
`maslo-lnyanoe.jpg`, `maslo-tykvennoe.jpg`, `maslo-konoplyanoe.jpg` (взять у клиента в высоком качестве).

**Правило описаний:** без медицинских заявлений — только вкус, состав, применение, способ отжима.

## Аналитика
Счётчики Яндекс.Метрика (`99571167`) и Top.Mail.Ru (`3605421`) подключены в `src/components/Analytics.astro`
и `src/data/site.js`. Цель `order_submit` отправляется в Метрику при успешной заявке.

## Что запросить у клиента
- Полный список позиций (фото + цены) — в Tilda их больше, статикой не вытягиваются.
- Оригиналы фото в высоком качестве.
- Доступы amoCRM (см. `.env.example`), токен Telegram-бота и chat_id, SMTP-данные mail.ru.
- Ключи мерчанта Робокассы (онлайн-оплата) — добавим отдельным шагом после показа.
- Доступ к DNS `ekopremium.ru` — для подключения домена.
- Точные сроки хранения масел — для FAQ.
