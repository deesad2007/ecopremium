#!/usr/bin/env bash
# Подключение amoCRM к сайту.
# Токен читается строго с клавиатуры (/dev/tty) и никуда не печатается.
# Запасной путь, если с клавиатурой не выходит:
#   1) положить токен в файл:  nano ~/token.txt
#   2) запустить:              ./scripts/setup-amocrm.sh ~/token.txt
#   3) удалить файл:           rm ~/token.txt
set -uo pipefail
cd "$(dirname "$0")/.."

SUB="${SUB:-ekopremi1}"
API="https://$SUB.amocrm.ru/api/v4"
echo "Поддомен amoCRM: $SUB"

TOKEN=""
if [ -n "${1:-}" ]; then
  if [ -f "$1" ]; then
    TOKEN=$(tr -d '[:space:]' < "$1")
    echo "Токен прочитан из файла: $1"
  else
    echo "✗ Файл не найден: $1"; exit 1
  fi
elif [ -r /dev/tty ]; then
  # Вычищаем буфер терминала: остаток дважды вставленной команды
  # иначе попадёт сюда вместо токена.
  while read -r -s -t 0.1 _junk < /dev/tty; do :; done
  printf 'Вставь долгосрочный токен amoCRM и нажми Enter (символы не отображаются): '
  read -rs TOKEN < /dev/tty
  echo
  TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
else
  echo "✗ Скрипт запущен без клавиатуры и не может спросить токен."
  echo "  Положи токен в файл и передай путь:  ./scripts/setup-amocrm.sh ~/token.txt"
  exit 1
fi

if [ -z "$TOKEN" ]; then
  echo "✗ Токен пустой — ничего не изменено."
  exit 1
fi

get() { curl -s -m 20 -H "Authorization: Bearer $TOKEN" "$API/$1"; }

echo
echo "Проверяю токен…"
acc=$(get "account")
name=$(printf '%s' "$acc" | python3 -c "
import sys, json
try: print(json.load(sys.stdin).get('name',''))
except Exception: print('')
")
if [ -z "$name" ]; then
  echo "✗ amoCRM не принял токен."
  echo "  Проверь: токен именно «долгосрочный», скопирован целиком, поддомен = $SUB"
  echo "  Ответ amoCRM: $(printf '%s' "$acc" | head -c 160)"
  exit 1
fi
echo "✓ Токен рабочий. Аккаунт: $name"

read -r PHONE_ID EMAIL_ID <<<"$(get 'contacts/custom_fields?limit=250' | python3 -c "
import sys, json
try: d = json.load(sys.stdin).get('_embedded',{}).get('custom_fields',[])
except Exception: d = []
ids = {f.get('code'): f.get('id') for f in d if f.get('code') in ('PHONE','EMAIL')}
print(ids.get('PHONE',''), ids.get('EMAIL',''))
")"
echo "✓ Поле телефона: ${PHONE_ID:-не найдено} | поле почты: ${EMAIL_ID:-не найдено}"

echo
echo "Воронки и статусы (пришли это Клоду):"
get "leads/pipelines" | python3 -c "
import sys, json
try: ps = json.load(sys.stdin).get('_embedded',{}).get('pipelines',[])
except Exception: ps = []
for p in ps:
    print('  воронка', p['id'], ' ', p['name'])
    for s in p.get('_embedded',{}).get('statuses',[])[:3]:
        print('      статус', s['id'], ' ', s['name'])
"

echo
echo "Записываю ключи на хостинг:"
put() {
  key="$1"; val="$2"
  if [ -z "$val" ]; then echo "  $key — пропущено (пусто)"; return; fi
  npx vercel env rm "$key" production --yes >/dev/null 2>&1
  if printf '%s' "$val" | npx vercel env add "$key" production >/dev/null 2>&1; then
    echo "  $key ✓"
  else
    echo "  $key ✗ не записалось"
  fi
}
put AMOCRM_SUBDOMAIN "$SUB"
put AMOCRM_ACCESS_TOKEN "$TOKEN"
put AMOCRM_PHONE_FIELD_ID "$PHONE_ID"
put AMOCRM_EMAIL_FIELD_ID "$EMAIL_ID"

echo
echo "Готово. Если читал токен из файла — удали его: rm ${1:-~/token.txt}"
echo "Скажи Клоду — он передеплоит и отправит тестовую заявку."
