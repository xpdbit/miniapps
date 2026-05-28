#!/bin/bash
echo "=== CONTAINERS ==="
docker ps --format 'table {{.Names}}\t{{.Status}}'

echo ""
echo "=== RESOURCES ==="
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'

echo ""
echo "=== SWAP STATUS (should match memory limit = swap disabled) ==="
for c in tavern-server dashboard-api docker-mysql docker-nginx; do
  swap=$(docker inspect $c --format '{{.HostConfig.MemorySwap}}' 2>/dev/null)
  mem=$(docker inspect $c --format '{{.HostConfig.Memory}}' 2>/dev/null)
  echo "  $c: memory=$mem swap=$swap (equal=disabled)"
done

echo ""
echo "=== NODE_OPTIONS in containers ==="
echo -n "  tavern-server: "
docker exec tavern-server sh -c 'echo $NODE_OPTIONS' 2>&1
echo -n "  dashboard-api: "
docker exec dashboard-api sh -c 'echo $NODE_OPTIONS' 2>&1

echo ""
echo "=== HEALTH ==="
curl -sk -o /dev/null -w 'Dashboard: %{http_code}\n' https://mnapp.top/dashboard --connect-timeout 10
curl -sk -o /dev/null -w 'Tavern:   %{http_code}\n' https://mnapp.top/api/v1/tavern/health --connect-timeout 10

echo ""
echo "=== HOST MEMORY ==="
free -m | head -2
