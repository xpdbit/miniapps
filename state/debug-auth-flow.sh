#!/bin/bash
set -e

echo "1. Login as admin..."
LOGIN=$(curl -s -X POST http://localhost/api/v1/tavern/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"credential":"admin","password":"Admin123!"}')
echo "$LOGIN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',{})
print('  token:', data.get('access_token','N/A')[:30]+'...')
print('  uuid:', data.get('user',{}).get('uuid','N/A'))
print('  role:', data.get('user',{}).get('role','N/A'))
"

echo ""
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('access_token',''))" 2>/dev/null)

echo "2. Decode JWT sub claim..."
python3 -c "
import base64,json
parts='$TOKEN'.split('.')
if len(parts)>1:
    padded=parts[1]+'='*(4-len(parts[1])%4)
    try:
        payload=json.loads(base64.urlsafe_b64decode(padded))
        print('  sub:', payload.get('sub'))
        print('  role:', payload.get('role'))
    except Exception as e:
        print('  decode failed:', e)
"

echo ""
echo "3. Call /models..."
curl -s http://localhost/api/v1/tavern/models -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  code:', d.get('code'))
print('  data count:', len(d.get('data',[])))
"
