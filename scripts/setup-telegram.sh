#!/usr/bin/env bash
# Подключение Telegram-бота для дублирования заявок.
set -uo pipefail
cd "$(dirname "$0")/.."

printf 'Вставь токен бота от @BotFather и нажми Enter (символы не отображаются): '
read -rs BOT; echo; echo
[ -z "$BOT" ] && { echo "Токен пустой — отмена."; exit 1; }

me=$(curl -s -m 20 "https://api.telegram.org/bot$BOT/getMe" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    print(r['result']['username'] if r.get('ok') else '')
except Exception: print('')
")
[ -z "$me" ] && { echo "✗ Токен бота не принят."; exit 1; }
echo "✓ Бот @$me"
echo
echo "Теперь ты и владелец должны написать боту «Старт» (или добавить его в группу),"
echo "иначе Telegram не покажет чат. Сделали — нажми Enter."
read -r _

chats=$(curl -s -m 20 "https://api.telegram.org/bot$BOT/getUpdates" | python3 -c "
import sys, json
seen = {}
for u in json.load(sys.stdin).get('result', []):
    m = u.get('message') or u.get('my_chat_member') or {}
    c = m.get('chat')
    if c: seen[c['id']] = c.get('title') or ((c.get('first_name','') + ' ' + c.get('last_name','')).strip()) or c.get('username','')
for k, v in seen.items(): print(k, v)
")
if [ -z "$chats" ]; then
  echo "✗ Ни одного чата не видно. Напишите боту любое сообщение и запустите скрипт заново."
  exit 1
fi
echo "Найденные чаты:"; echo "$chats" | sed 's/^/  /'
echo
printf 'Впиши номера чатов через запятую (можно несколько): '
read -r IDS
[ -z "$IDS" ] && { echo "Пусто — отмена."; exit 1; }

put() {
  local key="$1" val="$2"
  npx vercel env rm "$key" production --yes >/dev/null 2>&1
  if printf '%s' "$val" | npx vercel env add "$key" production >/dev/null 2>&1; then
    echo "  $key ✓"
  else
    echo "  $key ✗ не записалось"
  fi
}
echo "Записываю ключи на хостинг:"
put TELEGRAM_BOT_TOKEN "$BOT"
put TELEGRAM_CHAT_ID "$IDS"
echo
echo "Готово. Скажи Клоду — он передеплоит и отправит тестовую заявку."
