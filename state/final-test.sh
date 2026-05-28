#!/bin/bash
set -e

# Login
TOKEN=$(curl -s -X POST http://localhost/api/v1/tavern/auth/login \
  -H "Content-Type: application/json" \
  -d '{"credential":"admin","password":"Admin123!"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "Login failed!"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:30}..."

# Call models
echo ""
echo "=== /models response ==="
RESP=$(curl -s http://localhost/api/v1/tavern/models -H "Authorization: Bearer $TOKEN")
echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('code:', d.get('code'))
print('data length:', len(d.get('data',[])))
"

# Check server logs
echo ""
echo "=== Server logs (last 5) ==="
docker logs tavern-server 2>&1 | tail -5
