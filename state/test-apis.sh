#!/bin/bash
echo "=== Test all Tavern API paths ==="

echo ""
echo "--- Direct Tav Server (port 3002) ---"
docker exec docker-nginx curl -s -o /dev/null -w "  /health: %{http_code}\n" http://tavern-server:3002/health --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "  /api/v1/characters: %{http_code}\n" http://tavern-server:3002/api/v1/characters --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "  /v1/characters: %{http_code}\n" http://tavern-server:3002/v1/characters --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "  /api/v1/admin/dashboard/stats: %{http_code}\n" http://tavern-server:3002/api/v1/admin/dashboard/stats --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "  /v1/admin/dashboard/stats: %{http_code}\n" http://tavern-server:3002/v1/admin/dashboard/stats --connect-timeout 5

echo ""
echo "--- Via Dashboard Proxy (port 3001) ---"
docker exec docker-nginx curl -s -o /dev/null -w "  /api/v1/admin/tavern/dashboard/stats: %{http_code}\n" http://dashboard-api:3001/api/v1/admin/tavern/dashboard/stats --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "  /api/v1/admin/tavern/characters: %{http_code}\n" http://dashboard-api:3001/api/v1/admin/tavern/characters --connect-timeout 5

echo ""
echo "--- Via Nginx (localhost) ---"
curl -s -o /dev/null -w "  /api/v1/tavern/health: %{http_code}\n" http://localhost/api/v1/tavern/health --connect-timeout 5
curl -s -o /dev/null -w "  /api/v1/tavern/characters: %{http_code}\n" http://localhost/api/v1/tavern/characters --connect-timeout 5
curl -s -o /dev/null -w "  /api/v1/tavern/admin/dashboard/stats: %{http_code}\n" http://localhost/api/v1/tavern/admin/dashboard/stats --connect-timeout 5
curl -s -o /dev/null -w "  /api/v1/admin/tavern/dashboard/stats: %{http_code}\n" http://localhost/api/v1/admin/tavern/dashboard/stats --connect-timeout 5
