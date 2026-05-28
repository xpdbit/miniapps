#!/bin/bash
# Update TAVERN_ADMIN_TOKEN in .env with proper JWT
cd /opt/ftg/deploy

# Backup
cp .env .env.bak.admin-token

# Replace or add TAVERN_ADMIN_TOKEN
ADMIN_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi0wMDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzkzNTU4MzIsImV4cCI6MTgxMDg5MTgzMn0.9U2Adje2Ict6Ih2zNQnAw5Z5i70ei6Mz72r8rb6rgzQ"

if grep -q "^TAVERN_ADMIN_TOKEN=" .env; then
  sed -i "s|^TAVERN_ADMIN_TOKEN=.*|TAVERN_ADMIN_TOKEN=${ADMIN_JWT}|" .env
else
  echo "TAVERN_ADMIN_TOKEN=${ADMIN_JWT}" >> .env
fi

echo "Updated TAVERN_ADMIN_TOKEN in .env"
grep "TAVERN_ADMIN_TOKEN" .env | head -c 80
echo "..."

# Also update the proxy file in container to handle the token
# (the proxy reads from process.env which gets the .env value)

# Recreate dashboard-api with new env
docker compose --env-file .env up -d --force-recreate dashboard-api 2>&1 | tail -3
sleep 10

# Test
echo ""
echo "=== Test proxy with new JWT ==="
docker exec docker-nginx curl -s -o /dev/null -w "dashboard/stats: %{http_code}\n" http://dashboard-api:3001/api/v1/admin/tavern/dashboard/stats --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "characters: %{http_code}\n" http://dashboard-api:3001/api/v1/admin/tavern/characters --connect-timeout 5
