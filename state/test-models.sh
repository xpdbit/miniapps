#!/bin/bash
set -e

echo "1. Login as admin..."
LOGIN=$(curl -s -X POST http://localhost/api/v1/tavern/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"credential":"admin","password":"Admin123!"}')
TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("data",{}).get("access_token",""))' 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Login failed: $LOGIN"
  exit 1
fi
echo "  Token: ${TOKEN:0:30}..."

echo ""
echo "2. GET /v1/models..."
MODELS=$(curl -s http://localhost/api/v1/tavern/models -H "Authorization: Bearer $TOKEN")
echo "$MODELS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
count=len(d.get('data',[]))
print('  code=' + str(d['code']) + ', models=' + str(count))
for m in d.get('data',[]):
    print('    - ' + m['modelId'].ljust(30) + ' (' + m['provider'].ljust(12) + ') ' + m['minTier'])
"
