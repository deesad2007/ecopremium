#!/usr/bin/env bash
# Проверка оплаты Робокассой на локально собранном сайте.
# Боевые пароли не нужны и не используются: берём заведомо тестовые значения,
# поднимаем сервер на свободном порту и смотрим, что он делает.
#
# Запуск:  ./scripts/check-pay.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3987
BASE="http://127.0.0.1:$PORT"
LOG="$(mktemp -t ecopay)"

export ROBOKASSA_LOGIN="test_shop"
export ROBOKASSA_PASS1="pass_one"
export ROBOKASSA_PASS2="pass_two"
export ROBOKASSA_SNO="usn_income"
export ROBOKASSA_VAT="none"
export ROBOKASSA_IS_TEST=1
export PORT

ok=0; fail=0
say()  { printf '  %s %s\n' "$1" "$2"; }
pass() { ok=$((ok+1)); say '✓' "$1"; }
bad()  { fail=$((fail+1)); say '✗' "$1"; }

cd "$ROOT" || exit 1
node server.js > "$LOG" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; rm -f "$LOG"' EXIT

curl -s --retry 25 --retry-delay 1 --retry-connrefused -o /dev/null -m 10 "$BASE/" || {
  echo "сервер не поднялся:"; cat "$LOG"; exit 1; }

echo "Оплата:"

# ── создание счёта ──
RESP=$(curl -s -m 15 -X POST "$BASE/api/pay" -H 'Content-Type: application/json' \
  -d '{"name":"Проверка","phone":"+79990000000","email":"test@example.com","items":[{"id":"002","volume":"500 мл","qty":2}]}')

URL=$(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("url",""))' 2>/dev/null)
SUM=$(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("sum",""))' 2>/dev/null)
INV=$(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("invId",""))' 2>/dev/null)

[ -n "$URL" ] && pass "счёт создан, номер $INV на сумму $SUM ₽" || { bad "счёт не создан: $RESP"; }

case "$URL" in
  https://auth.robokassa.ru/Merchant/Index.aspx*) pass "ссылка ведёт на Робокассу" ;;
  *) bad "неожиданный адрес оплаты: ${URL:-пусто}" ;;
esac

# подпись должна совпасть с тем, что насчитает сам сервер Робокассы
python3 - "$URL" <<'PY'
import sys, hashlib
from urllib.parse import urlparse, parse_qs, quote
q = parse_qs(urlparse(sys.argv[1]).query)
g = lambda k: q.get(k, [''])[0]
receipt_enc = quote(g('Receipt'), safe='')
mine = hashlib.md5(':'.join(['test_shop', g('OutSum'), g('InvId'), receipt_enc, 'pass_one']).encode()).hexdigest()
print('  %s подпись запроса сходится' % ('✓' if mine == g('SignatureValue') else '✗'))
print('  %s чек содержит позиции и систему налогообложения' % ('✓' if '"sno"' in g('Receipt') and '"items"' in g('Receipt') else '✗'))
print('  %s тестовый режим включён' % ('✓' if g('IsTest') == '1' else '✗'))
PY

# ── цена берётся с сервера, а не из браузера ──
CHEAT=$(curl -s -m 15 -X POST "$BASE/api/pay" -H 'Content-Type: application/json' \
  -d '{"name":"Проверка","phone":"+79990000000","items":[{"id":"002","volume":"500 мл","qty":1,"price":1}]}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("sum",""))' 2>/dev/null)
[ "$CHEAT" != "1.00" ] && pass "подменить цену из браузера нельзя (сумма $CHEAT ₽)" || bad "цена взята из запроса — это дыра"

# ── товар без цены ──
NOPRICE=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST "$BASE/api/pay" -H 'Content-Type: application/json' \
  -d '{"name":"Проверка","phone":"+79990000000","items":[{"id":"401","qty":1}]}')
[ "$NOPRICE" = "400" ] && pass "товар без цены к оплате не пускается" || bad "товар без цены дал код $NOPRICE"

echo "Уведомление об оплате:"

# ── верная подпись ──
GOOD_SIG=$(python3 -c "import hashlib,sys; print(hashlib.md5(('%s:%s:pass_two' % ('$SUM','$INV')).encode()).hexdigest())")
ANSWER=$(curl -s -m 15 -X POST "$BASE/api/robokassa-result" \
  -d "OutSum=$SUM&InvId=$INV&SignatureValue=$GOOD_SIG")
[ "$ANSWER" = "OK$INV" ] && pass "верная подпись принята, ответ OK$INV" || bad "ответ на верную подпись: $ANSWER"

# ── неверная подпись ──
CODE=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST "$BASE/api/robokassa-result" \
  -d "OutSum=$SUM&InvId=$INV&SignatureValue=00000000000000000000000000000000")
[ "$CODE" = "403" ] && pass "поддельная подпись отклонена" || bad "поддельная подпись дала код $CODE"

echo "Страницы результата:"
for p in /pay/success /pay/fail; do
  C=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BASE$p")
  [ "$C" = "200" ] && pass "$p отвечает" || bad "$p дал код $C"
done

echo
echo "Итого: успешно $ok, с ошибками $fail"
[ "$fail" -eq 0 ]
