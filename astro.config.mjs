import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

// Сайт статический (output: 'hybrid'), кроме /api/order — она рендерится
// на сервере (Vercel Function), см. `export const prerender = false` в файле роута.
export default defineConfig({
  site: 'https://ekopremium.ru',
  output: 'hybrid',
  adapter: vercel(),
  build: {
    format: 'directory',
  },
});
