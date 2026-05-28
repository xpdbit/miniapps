#!/bin/bash
echo "=== Deploy verification ==="
echo ""

echo "--- Dashboard index.html ---"
ls -la /opt/ftg/deploy/nginx/html/index.html 2>&1

echo ""
echo "--- New JS files (Tavern) ---"
ls -la /opt/ftg/deploy/nginx/html/assets/ | grep -i tavern 2>/dev/null || echo "(none)"
ls /opt/ftg/deploy/nginx/html/assets/ | head -10

echo ""
echo "--- Nginx health ---"
curl -sk -o /dev/null -w "HTTPS Dashboard: %{http_code}\n" https://mnapp.top/dashboard --connect-timeout 10

echo ""
echo "--- Full API test ---"
curl -sk -o /dev/null -w "/api/v1/tavern/health: %{http_code}\n" https://mnapp.top/api/v1/tavern/health --connect-timeout 5
curl -sk -o /dev/null -w "/api/v1/tavern/admin/dashboard/stats: %{http_code}\n" https://mnapp.top/api/v1/tavern/admin/dashboard/stats -H "Authorization: Bearer tavern_admin" --connect-timeout 5
curl -sk -o /dev/null -w "/api/v1/admin/tavern/dashboard/stats: %{http_code}\n" https://mnapp.top/api/v1/admin/tavern/dashboard/stats --connect-timeout 5
