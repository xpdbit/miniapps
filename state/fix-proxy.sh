#!/bin/bash
set -e
# Compile updated tavern-proxy.ts and replace in container

# Ensure node_modules exist for compilation
cd /opt/ftg

# Copy the updated proxy into the container where we can compile
docker cp /opt/ftg/dashboard/server/routes/tavern-proxy.ts dashboard-api:/tmp/tavern-proxy.ts

# Compile inside container
docker exec dashboard-api sh -c "cd /app && npx tsc --esModuleInterop --module commonjs --target es2020 --skipLibCheck /tmp/tavern-proxy.ts --outDir /tmp/ 2>&1 || true"

# Check if compiled
docker exec dashboard-api ls -la /tmp/tavern-proxy.js 2>&1

# Replace the old compiled file
docker exec dashboard-api sh -c "cp /tmp/tavern-proxy.js /app/dist/routes/tavern-proxy.js 2>&1"

# Restart
docker restart dashboard-api
echo "Restarting..."
sleep 10
docker ps --filter name=dashboard-api --format 'table {{.Names}}\t{{.Status}}'

# Test the proxy
echo ""
echo "=== Test proxy after fix ==="
docker exec docker-nginx curl -s -o /dev/null -w "/api/v1/admin/tavern/characters: %{http_code}\n" http://dashboard-api:3001/api/v1/admin/tavern/characters --connect-timeout 5
docker exec docker-nginx curl -s -o /dev/null -w "/api/v1/admin/tavern/dashboard/stats: %{http_code}\n" http://dashboard-api:3001/api/v1/admin/tavern/dashboard/stats --connect-timeout 5
