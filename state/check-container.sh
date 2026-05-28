#!/bin/bash
echo "=== Container route files ==="
docker exec tavern-server ls -la /app/src/routes/ 2>&1
echo ""
echo "=== Check admin exists ==="
docker exec tavern-server test -f /app/src/routes/admin.ts && echo "admin.ts EXISTS" || echo "admin.ts NOT FOUND"
echo ""
echo "=== Check model-sync exists ==="
docker exec tavern-server test -f /app/src/services/model-sync.service.ts && echo "model-sync EXISTS" || echo "model-sync NOT FOUND"
