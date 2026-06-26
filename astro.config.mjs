import { defineConfig } from 'astro/config';

// Статический сайт. Формы заказа обрабатываются Netlify-функцией (/.netlify/functions/order).
export default defineConfig({
  site: 'https://ekopremium.netlify.app',
  output: 'static',
  build: {
    format: 'directory',
  },
});
