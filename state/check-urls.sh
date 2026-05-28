#!/bin/bash
echo "=== Check API URLs in deployed JS ==="
for f in TavernCharacters-B4N7lyTn.js TavernCards-COhwJv_H.js index-DlH5HAyi.js; do
  echo "--- $f ---"
  grep -oP 'api/(admin/tavern|tavern/[^"'"'"']*)' /opt/ftg/deploy/nginx/html/assets/"$f" 2>/dev/null | sort -u | head -5
done

echo ""
echo "=== Check for double-api ==="
grep -r 'api/tavern/api' /opt/ftg/deploy/nginx/html/assets/ 2>/dev/null | wc -l
echo "double-api occurrences (should be 0)"
