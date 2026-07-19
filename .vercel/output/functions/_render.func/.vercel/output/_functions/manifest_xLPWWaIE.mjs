import 'cookie';
import 'kleur/colors';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_DvBfDRvv.mjs';
import 'es-module-lexer';
import { e as decodeKey } from './chunks/astro/server_BLF2SSSy.mjs';
import 'clsx';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///Users/david/ecopremium/","adapterName":"@astrojs/vercel/serverless","routes":[{"file":"about/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/about","isIndex":false,"type":"page","pattern":"^\\/about\\/?$","segments":[[{"content":"about","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/about.astro","pathname":"/about","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"catalog/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/catalog","isIndex":false,"type":"page","pattern":"^\\/catalog\\/?$","segments":[[{"content":"catalog","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/catalog.astro","pathname":"/catalog","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"contacts/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/contacts","isIndex":false,"type":"page","pattern":"^\\/contacts\\/?$","segments":[[{"content":"contacts","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/contacts.astro","pathname":"/contacts","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"delivery/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/delivery","isIndex":false,"type":"page","pattern":"^\\/delivery\\/?$","segments":[[{"content":"delivery","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/delivery.astro","pathname":"/delivery","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/order","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/order\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"order","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/order.js","pathname":"/api/order","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"site":"https://ekopremium.vercel.app","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/Users/david/ecopremium/src/pages/about.astro",{"propagation":"none","containsHead":true}],["/Users/david/ecopremium/src/pages/catalog.astro",{"propagation":"none","containsHead":true}],["/Users/david/ecopremium/src/pages/contacts.astro",{"propagation":"none","containsHead":true}],["/Users/david/ecopremium/src/pages/delivery.astro",{"propagation":"none","containsHead":true}],["/Users/david/ecopremium/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/Users/david/ecopremium/src/pages/product/[id].astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:src/pages/about@_@astro":"pages/about.astro.mjs","\u0000@astro-page:src/pages/api/order@_@js":"pages/api/order.astro.mjs","\u0000@astro-page:src/pages/catalog@_@astro":"pages/catalog.astro.mjs","\u0000@astro-page:src/pages/contacts@_@astro":"pages/contacts.astro.mjs","\u0000@astro-page:src/pages/delivery@_@astro":"pages/delivery.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astro-page:src/pages/product/[id]@_@astro":"pages/product/_id_.astro.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","/Users/david/ecopremium/node_modules/astro/dist/env/setup.js":"chunks/astro/env-setup_Cr6XTFvb.mjs","\u0000@astrojs-manifest":"manifest_xLPWWaIE.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.j8EnN0-W.js","/astro/hoisted.js?q=1":"_astro/hoisted.DZscB7KC.js","/astro/hoisted.js?q=2":"_astro/hoisted.C7OJUIDv.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/about.3nJj2M12.css","/favicon.svg","/_astro/hoisted.C7OJUIDv.js","/_astro/hoisted.DZscB7KC.js","/_astro/hoisted.j8EnN0-W.js","/img/badge-kremlin-emblem.png","/img/badge-kremlin.jpg","/img/badge-organic.jpg","/img/hero.jpg","/img/maslo-abrikos.jpg","/img/maslo-amarantovoe.jpg","/img/maslo-chernyi-tmin.jpg","/img/maslo-gorchichnoe.jpg","/img/maslo-greckiy-oreh.jpg","/img/maslo-kedrovoe.jpg","/img/maslo-konoplyanoe.jpg","/img/maslo-lnyanoe.jpg","/img/maslo-oblepihovoe.jpg","/img/maslo-podsolnechnoe.jpg","/img/maslo-rastoropshi.jpg","/img/maslo-tykvennoe.jpg","/img/docs/dogovor-kremlin.jpg","/img/docs/sertifikat-roskachestvo.jpg","/about/index.html","/catalog/index.html","/contacts/index.html","/delivery/index.html","/index.html"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"W42J4CXAdVv/9jE2u5nLCP/J5O8b9sLyRAihpbSOW4w=","experimentalEnvGetSecretEnabled":false});

export { manifest };
