#!/bin/bash
# Add debug logging to the tier route, rebuild and retest
set -e

echo "1. Adding debug log to tier.ts..."
cd /opt/ftg/apps/tavern/server
# Backup original
cp src/routes/tier.ts src/routes/tier.ts.bak

# Add debug log
sed -i 's|const models = await getAvailableModels(req.user!.userId)|console.log("[DEBUG] userId from req:", req.user!.userId); const models = await getAvailableModels(req.user!.userId)|' src/routes/tier.ts

echo "2. Rebuilding tavern-server..."
cd /opt/ftg/deploy
docker compose --env-file .env build tavern-server 2>&1 | tail -3

echo "3. Restarting..."
docker stop tavern-server 2>/dev/null
docker rm -f tavern-server 2>/dev/null
docker compose --env-file .env up -d tavern-server 2>&1 | tail -5

sleep 5

echo "4. Testing..."
TOKEN=$(curl -s -X POST http://localhost/api/v1/tavern/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"credential":"admin","password":"Admin123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('access_token',''))" 2>/dev/null)

curl -s http://localhost/api/v1/tavern/models -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('models:', len(d.get('data',[])))"

echo ""
echo "5. Server logs..."
docker logs tavern-server 2>&1 | grep DEBUG | tail -5

# Restore original
cp src/routes/tier.ts.bak src/routes/tier.ts
