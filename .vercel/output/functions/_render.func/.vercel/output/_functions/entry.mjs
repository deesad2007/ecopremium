import { renderers } from './renderers.mjs';
import { c as createExports } from './chunks/entrypoint_BoMAc1uc.mjs';
import { manifest } from './manifest_CPoA0UkC.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/about.astro.mjs');
const _page2 = () => import('./pages/api/order.astro.mjs');
const _page3 = () => import('./pages/catalog.astro.mjs');
const _page4 = () => import('./pages/contacts.astro.mjs');
const _page5 = () => import('./pages/delivery.astro.mjs');
const _page6 = () => import('./pages/product/_id_.astro.mjs');
const _page7 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/about.astro", _page1],
    ["src/pages/api/order.js", _page2],
    ["src/pages/catalog.astro", _page3],
    ["src/pages/contacts.astro", _page4],
    ["src/pages/delivery.astro", _page5],
    ["src/pages/product/[id].astro", _page6],
    ["src/pages/index.astro", _page7]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "c42ff0a7-d93b-4a86-86bd-981d5595404a",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
