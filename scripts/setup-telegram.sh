#!/usr/bin/env bash
# Подключение Telegram-бота для дублирования заявок.
# Токен читается с клавиатуры (/dev/tty) либо из файла: ./scripts/setup-telegram.sh ~/bot.txt
set -uo pipefail
cd "$(dirname "$0")/.."

BOT=""
if [ -n "${1:-}" ]; then
  if [ -f "$1" ]; then
    BOT=$(tr -d '[:space:]' < "$1"); echo "Токен прочитан из файла: $1"
  else
    echo "✗ Файл не найден: $1"; exit 1
  fi
elif [ -r /dev/tty ]; then
  # Вычищаем буфер терминала: остаток дважды вставленной команды
  # иначе попадёт сюда вместо токена.
  while read -r -s -t 0.1 _junk < /dev/tty; do :; done
  printf 'Вставь токен бота от @BotFather и нажми Enter (символы не отображаются): '
  read -rs BOT < /dev/tty
  echo
  BOT=$(printf '%s' "$BOT" | tr -d '[:space:]')
else
  echo "✗ Скрипт запущен без клавиатуры."
  echo "  Положи токен в файл и передай путь:  ./scripts/setup-telegram.sh ~/bot.txt"
  exit 1
fi
[ -z "$BOT" ] && { echo "✗ Токен пустой — ничего не изменено."; exit 1; }

me=$(curl -s -m 20 "https://api.telegram.org/bot$BOT/getMe" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin); print(r['result']['username'] if r.get('ok') else '')
except Exception: print('')
")
[ -z "$me" ] && { echo "✗ Telegram не принял токен бота."; exit 1; }
echo "✓ Бот @$me"
echo
echo "Теперь вы с владельцем должны написать боту «Старт» (или добавить его в группу),"
echo "иначе Telegram не покажет чат. Сделали — нажмите Enter."
[ -r /dev/tty ] && read -r _ < /dev/tty

chats=$(curl -s -m 20 "https://api.telegram.org/bot$BOT/getUpdates" | python3 -c "
import sys, json
seen = {}
try: ups = json.load(sys.stdin).get('result', [])
except Exception: ups = []
for u in ups:
    m = u.get('message') or u.get('my_chat_member') or {}
    c = m.get('chat')
    if c:
        seen[c['id']] = c.get('title') or (c.get('first_name','') + ' ' + c.get('last_name','')).strip() or c.get('username','')
for k, v in seen.items(): print(k, v)
")
if [ -z "$chats" ]; then
  echo "✗ Ни одного чата не видно. Напишите боту сообщение и запустите скрипт заново."
  exit 1
fi
echo "Найденные чаты:"; echo "$chats" | sed 's/^/  /'
echo
printf 'Впиши номера чатов через запятую: '
IDS=""
[ -r /dev/tty ] && read -r IDS < /dev/tty
[ -z "$IDS" ] && { echo "✗ Пусто — ничего не изменено."; exit 1; }

put() {
  key="$1"; val="$2"
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
echo "Готово. Если читал токен из файла — удали его: rm ${1:-~/bot.txt}"
echo "Скажи Клоду — он передеплоит и отправит тестовую заявку."
