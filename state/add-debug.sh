#!/bin/bash
set -e

# Add debug logging to tier.ts
cd /opt/ftg/apps/tavern/server

# Restore backup
cp src/routes/tier.ts.bak src/routes/tier.ts 2>/dev/null || true

# Add debug
sed -i 's|const models = await getAvailableModels(req.user!.userId)|console.log("[TIER-DEBUG] userId:", req.user!.userId); const models = await getAvailableModels(req.user!.userId); console.log("[TIER-DEBUG] result count:", models.length)|' src/routes/tier.ts

# Verify
echo "=== Modified tier.ts (relevant lines) ==="
grep -n "TIER-DEBUG\|getAvailableModels" src/routes/tier.ts

# Restart container
docker restart tavern-server
sleep 8

# Test
TOKEN=$(curl -s -X POST http://localhost/api/v1/tavern/auth/login \
  -H "Content-Type: application/json" \
  -d '{"credential":"admin","password":"Admin123!"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('access_token',''))")

curl -s http://localhost/api/v1/tavern/models -H "Authorization: Bearer $TOKEN" > /dev/null

echo ""
echo "=== Server debug logs ==="
docker logs tavern-server 2>&1 | grep TIER-DEBUG | tail -10
