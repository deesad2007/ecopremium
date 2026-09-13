#!/usr/bin/env bash
# Проверка сайта — гоняем до и сразу после переключения домена.
#   ./scripts/check-site.sh                      → проверить текущий адрес на Vercel
#   ./scripts/check-site.sh https://ekopremium.ru → проверить боевой домен
#   ./scripts/check-site.sh https://ekopremium.ru --order → плюс отправить тестовую заявку
set -uo pipefail
BASE="${1:-https://ekopremium.vercel.app}"
BASE="${BASE%/}"
ORDER="${2:-}"
ok=0; bad=0
say() { if [ "$1" = "ok" ]; then ok=$((ok+1)); printf '  ✓ %s\n' "$2"; else bad=$((bad+1)); printf '  ✗ %s\n' "$2"; fi; }

code() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$1"; }
redir() { curl -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "$1"; }

echo "Проверяю: $BASE"
echo
echo "Страницы:"
for p in / /catalog /about /delivery /contacts /oferta /product/002 /product/162 /product/210; do
  c=$(code "$BASE$p")
  [ "$c" = "200" ] && say ok "$p" || say bad "$p → HTTP $c"
done

echo "Служебное:"
for p in /sitemap.xml /robots.txt /img/maslo-lnyanoe.webp /img/zhmyh-tykvennyi.webp; do
  c=$(code "$BASE$p")
  [ "$c" = "200" ] && say ok "$p" || say bad "$p → HTTP $c"
done
c=$(code "$BASE/такой-страницы-нет-12345")
[ "$c" = "404" ] && say ok "несуществующий адрес отдаёт 404" || say bad "несуществующий адрес отдаёт $c"

echo "Переадресации со старых адресов Тильды:"
for pair in "/len:/product/002" "/tikva:/product/003" "/kontacts:/contacts" "/kokos:/catalog" "/statya:/about"; do
  src="${pair%%:*}"; want="${pair##*:}"
  r=$(redir "$BASE$src")
  case "$r" in
    301*"$want"*) say ok "$src → $want" ;;
    *) say bad "$src → получено: $r" ;;
  esac
done

echo "Содержимое:"
n=$(curl -s -m 20 "$BASE/catalog" | grep -o 'class="pc"' | wc -l | tr -d ' ')
[ "$n" -ge 70 ] && say ok "в каталоге карточек: $n" || say bad "в каталоге карточек: $n (ожидали 70+)"
# канонические ссылки всегда должны вести на боевой домен, даже когда
# сайт проверяется по временному адресу на хостинге
if curl -s -m 20 "$BASE/" | grep -q 'rel="canonical" href="https://ekopremium.ru'; then
  say ok "канонические ссылки ведут на ekopremium.ru"
else
  say bad "канонические ссылки не на ekopremium.ru — проверить site в astro.config.mjs"
fi

if [ "$ORDER" = "--order" ]; then
  echo "Тестовая заявка:"
  r=$(curl -s -m 30 -X POST "$BASE/api/order" -H 'Content-Type: application/json' \
    -d '{"name":"ТЕСТ проверка сайта","phone":"+79990000000","product":"Проверка связи","price":1,"comment":"Служебная заявка, можно удалить"}')
  printf '%s' "$r" | grep -q '"amocrm":{"ok":true}' && say ok "заявка принята amoCRM" || say bad "amoCRM: $(printf '%s' "$r" | head -c 120)"
  printf '%s' "$r" | grep -q '"telegram":{"ok":true}' && say ok "заявка ушла в Telegram" || echo "  · Telegram пока не подключён"
fi

echo
echo "Итого: успешно $ok, с ошибками $bad"
[ "$bad" -gt 0 ] && exit 1
exit 0
