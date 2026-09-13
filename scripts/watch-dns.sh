#!/usr/bin/env bash
# Следит, как домен переезжает на новый адрес. Опрашивает четыре публичных
# резолвера раз в 20 секунд и выходит, когда все увидят новый IP.
#   ./scripts/watch-dns.sh                      → ждём переезда на Vercel
#   ./scripts/watch-dns.sh ekopremium.ru 1.2.3.4 → ждём любой другой адрес
set -uo pipefail
cd "$(dirname "$0")/.."
DOMAIN="${1:-ekopremium.ru}"
TARGET="${2:-76.76.21.21}"
OLD="176.57.66.92"
RESOLVERS="8.8.8.8 1.1.1.1 77.88.8.8 9.9.9.9"
DEADLINE=$(( $(date +%s) + 1800 ))

echo "Жду, пока $DOMAIN переедет на $TARGET (старый адрес $OLD)."
echo "Проверяю каждые 20 секунд, максимум 30 минут. Ctrl+C — прервать."
echo
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  line=""; ready=0; total=0
  for r in $RESOLVERS; do
    total=$((total + 1))
    ip=$(dig +short +time=3 +tries=1 A "$DOMAIN" @"$r" 2>/dev/null | tail -1)
    case "$ip" in
      "$TARGET") mark="НОВЫЙ"; ready=$((ready + 1)) ;;
      "$OLD")    mark="старый" ;;
      "")        mark="молчит" ;;
      *)         mark="$ip" ;;
    esac
    line="$line  $r=$mark"
  done
  printf '%s  %s  [%d из %d]\n' "$(date +%H:%M:%S)" "$line" "$ready" "$total"
  if [ "$ready" -eq "$total" ]; then
    echo
    echo "✓ Все резолверы видят новый адрес. Запускаю проверку сайта."
    echo
    exec ./scripts/check-site.sh "https://$DOMAIN" --order
  fi
  sleep 20
done
echo
echo "Прошло 30 минут, переключились не все. Это не обязательно поломка —"
echo "у части провайдеров свои кэши. Проверь сайт вручную:"
echo "  ./scripts/check-site.sh https://$DOMAIN"
exit 1
