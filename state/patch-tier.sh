#!/bin/bash
set -e

# Patch the running server's tier.service.js to add debug logging
cd /opt/ftg/apps/tavern/server

# Add debug log to the getAvailableModels function
docker exec tavern-server sh -c "sed -i 's/async function getAvailableModels(userUuid) {/async function getAvailableModels(userUuid) { console.log(\"[DEBUG] getAvailableModels called with:\", userUuid);/' dist/services/tier.service.js"

# Add debug after getUserTier
docker exec tavern-server sh -c "sed -i 's/const userPriority = TIER_PRIORITY\[tierInfo.tier\];/const userPriority = TIER_PRIORITY[tierInfo.tier]; console.log(\"[DEBUG] tier:\", tierInfo.tier, \"priority:\", userPriority);/' dist/services/tier.service.js"

# Add debug after findMany
docker exec tavern-server sh -c "sed -i 's/orderBy: { sortOrder: .asc. },/orderBy: { sortOrder: \"asc\" }, }).then(function(r) { console.log(\"[DEBUG] allModels count:\", r.length); return r; }); var _unused =/' dist/services/tier.service.js"

# Restart server
docker restart tavern-server
sleep 5

echo "Patched and restarted. Testing..."
TOKEN=$(curl -s -X POST http://localhost/api/v1/tavern/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"credential":"admin","password":"Admin123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('access_token',''))" 2>/dev/null)

curl -s http://localhost/api/v1/tavern/models -H "Authorization: Bearer $TOKEN" -o /dev/null

echo "--- Logs ---"
docker logs tavern-server 2>&1 | grep DEBUG | tail -10
