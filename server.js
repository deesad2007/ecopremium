// Боевой сервер для размещения вне Vercel (Timeweb и любой другой Node-хостинг).
// Заголовки безопасности и переадресации со старых адресов Тильды берутся
// из vercel.json, чтобы настройки не разъехались между площадками.
import express from 'express';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler as astro } from './dist/server/entry.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf-8'));
const headers = cfg.headers?.[0]?.headers ?? [];
const redirects = new Map((cfg.redirects ?? []).map((r) => [r.source, r]));

const app = express();
app.disable('x-powered-by');

// Сжатие ответов. На Vercel оно включалось само, на своём сервере его нужно
// добавить руками: без него главная уезжает клиенту в 44 КБ вместо ~10 КБ.
app.use(compression());

// заголовки безопасности на каждый ответ, включая статические страницы
app.use((req, res, next) => {
  for (const h of headers) res.setHeader(h.key, h.value);
  next();
});

// постоянные переадресации со старых адресов сайта на Тильде
app.use((req, res, next) => {
  const clean = req.path.replace(/\/+$/, '') || '/';
  const rule = redirects.get(clean);
  if (rule) return res.redirect(rule.statusCode || 301, rule.destination);
  next();
});

// статика: хэшированные файлы кэшируем надолго, остальное проверяем каждый раз
app.use('/_astro', express.static(path.join(root, 'dist/client/_astro'), {
  maxAge: '1y', immutable: true,
}));
app.use(express.static(path.join(root, 'dist/client'), { maxAge: '1h' }));

// всё остальное отдаёт Astro
app.use(astro);

// Astro в режиме middleware не показывает страницу 404 сам: для ненайденных
// адресов он передаёт запрос дальше, и Express отвечает своей технической
// заглушкой «Cannot GET». На Vercel страницу подставляла площадка, здесь
// подставляем сами.
app.use((req, res) => {
  res.status(404).sendFile(path.join(root, 'dist/client/404.html'), (err) => {
    if (err && !res.headersSent) res.status(404).type('text/plain').send('Страница не найдена');
  });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => console.log(`EcoPremi слушает порт ${port}`));
