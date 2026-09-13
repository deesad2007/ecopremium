#!/usr/bin/env bash
# Подключение amoCRM к сайту. Токен вводится вручную, нигде не печатается
# и не сохраняется в файлы — уходит сразу в переменные окружения хостинга.
set -uo pipefail
cd "$(dirname "$0")/.."

SUB="${1:-ekopremi1}"
API="https://$SUB.amocrm.ru/api/v4"

printf 'Поддомен amoCRM: %s\n' "$SUB"
printf 'Вставь долгосрочный токен и нажми Enter (символы не отображаются): '
read -rs TOKEN; echo; echo

[ -z "$TOKEN" ] && { echo "Токен пустой — отмена."; exit 1; }

get() { curl -s -m 20 -H "Authorization: Bearer $TOKEN" "$API/$1"; }

# ── 1. проверяем, что токен рабочий ──
acc=$(get "account")
name=$(printf '%s' "$acc" | python3 -c "
import sys, json
try: print(json.load(sys.stdin).get('name',''))
except Exception: print('')
")
if [ -z "$name" ]; then
  echo "✗ Токен не принят. Проверь, что он долгосрочный и поддомен верный ($SUB)."
  echo "  Ответ amoCRM: $(printf '%s' "$acc" | head -c 200)"
  exit 1
fi
echo "✓ Токен рабочий. Аккаунт: $name"

# ── 2. ищем поля телефона и почты у контакта ──
read -r PHONE_ID EMAIL_ID <<<"$(get 'contacts/custom_fields?limit=250' | python3 -c "
import sys, json
d = json.load(sys.stdin).get('_embedded',{}).get('custom_fields',[])
ids = {f.get('code'): f.get('id') for f in d if f.get('code') in ('PHONE','EMAIL')}
print(ids.get('PHONE',''), ids.get('EMAIL',''))
")"
echo "✓ Поле телефона: ${PHONE_ID:-не найдено} | поле почты: ${EMAIL_ID:-не найдено}"

# ── 3. показываем воронки, чтобы выбрать, куда складывать заявки ──
echo
echo "Воронки и статусы:"
get "leads/pipelines" | python3 -c "
import sys, json
for p in json.load(sys.stdin).get('_embedded',{}).get('pipelines',[]):
    print(f\"  воронка {p['id']}  {p['name']}\")
    for s in p.get('_embedded',{}).get('statuses',[])[:3]:
        print(f\"      статус {s['id']}  {s['name']}\")
"
echo

# ── 4. пишем ключи на хостинг ──
put() {
  local key="$1" val="$2"
  [ -z "$val" ] && { echo "  $key — пропущено (пусто)"; return; }
  npx vercel env rm "$key" production --yes >/dev/null 2>&1
  if printf '%s' "$val" | npx vercel env add "$key" production >/dev/null 2>&1; then
    echo "  $key ✓"
  else
    echo "  $key ✗ не записалось"
  fi
}
echo "Записываю ключи на хостинг:"
put AMOCRM_SUBDOMAIN "$SUB"
put AMOCRM_ACCESS_TOKEN "$TOKEN"
put AMOCRM_PHONE_FIELD_ID "$PHONE_ID"
put AMOCRM_EMAIL_FIELD_ID "$EMAIL_ID"

echo
echo "Готово. Скажи Клоду — он передеплоит и отправит тестовую заявку."
