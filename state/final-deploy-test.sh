#!/bin/bash
docker cp /opt/ftg/apps/tavern/server/src/routes/admin.ts tavern-server:/app/src/routes/admin.ts
docker cp /opt/ftg/apps/tavern/server/src/services/moderation.service.ts tavern-server:/app/src/services/moderation.service.ts
docker restart tavern-server
echo "Waiting for restart..."
sleep 15
echo "=== FINAL TEST ==="
for ep in dashboard/stats characters pending model-stats chats keys; do
  code=$(docker exec docker-nginx curl -s -o /dev/null -w '%{http_code}' http://dashboard-api:3001/api/v1/admin/tavern/$ep --connect-timeout 5)
  echo "  $ep: $code"
done
echo ""
echo "--- data ---"
docker exec docker-nginx curl -s http://dashboard-api:3001/api/v1/admin/tavern/dashboard/stats --connect-timeout 5 | head -c 200
echo ""
docker exec docker-nginx curl -s http://dashboard-api:3001/api/v1/admin/tavern/characters --connect-timeout 5 | head -c 300
