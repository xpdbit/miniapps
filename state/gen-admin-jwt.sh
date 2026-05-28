#!/bin/bash
# Generate admin JWT for tavern-server
# Uses the same JWT_SECRET as tavern-server

JWT_SECRET=$(grep 'TAVERN_JWT_SECRET' /opt/ftg/deploy/.env | cut -d= -f2)
if [ -z "$JWT_SECRET" ]; then
  # Fallback to JWT_SECRET
  JWT_SECRET=$(grep '^JWT_SECRET' /opt/ftg/deploy/.env | cut -d= -f2)
fi

echo "JWT_SECRET length: ${#JWT_SECRET}"

# Generate token using Node.js
docker exec tavern-server node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || '$JWT_SECRET';
const token = jwt.sign({ sub: 'admin-001', role: 'ADMIN' }, secret, { expiresIn: '365d' });
console.log(token);
" 2>&1
