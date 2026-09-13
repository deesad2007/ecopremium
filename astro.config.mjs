import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import node from '@astrojs/node';

// Площадка выбирается переменной DEPLOY_TARGET:
//   без неё          -> Vercel (пока домен не переключён, прод живёт там)
//   DEPLOY_TARGET=node -> обычный Node-сервер (Timeweb), запускается через server.mjs
// Сайт статический (output: 'hybrid'), кроме /api/order: она рендерится на сервере.
const useNode = process.env.DEPLOY_TARGET === 'node';

export default defineConfig({
  site: 'https://ekopremium.ru',
  output: 'hybrid',
  adapter: useNode ? node({ mode: 'middleware' }) : vercel(),
  build: {
    format: 'directory',
  },
});
