// Мелкие помощники, общие для обработчиков в src/pages/api.

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Ограничение длины полей — чтобы нельзя было залить «простыню» в CRM и телеграм.
export const cut = (s, max) => String(s || '').trim().slice(0, max);

// ── простая защита от флуда: не больше N обращений с одного IP за окно ──
// Память живёт в пределах инстанса — это не «броня», но отсекает примитивный
// спам-флуд, не требуя внешнего хранилища.
export function makeRateLimiter({ max = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const hits = new Map();
  return (ip) => {
    if (!ip) return false;
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear(); // страховка от разрастания памяти
    return list.length > max;
  };
}
