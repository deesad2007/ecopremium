// Карта сайта для Яндекса и Google. Собирается из реального списка товаров.
import data from '../data/products.json';

const STATIC = ['/', '/catalog', '/about', '/delivery', '/contacts', '/oferta', '/policy'];

export async function GET({ site }) {
  const base = (site?.href || 'https://ekopremium.ru/').replace(/\/$/, '');
  const urls = [
    ...STATIC.map((p) => base + p),
    ...data.products.map((p) => `${base}/product/${p.id}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
