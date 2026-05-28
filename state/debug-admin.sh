#!/bin/bash
echo "=== Container admin.ts (79 bytes) ==="
docker exec tavern-server cat /app/src/routes/admin.ts
echo ""
echo "=== Container index.ts routes ==="
docker exec tavern-server cat /app/src/routes/index.ts
echo ""
echo "=== Host admin.ts ==="
wc -c /opt/ftg/apps/tavern/server/src/routes/admin.ts
