#!/bin/bash
# 精确插入 MySQL 调优 command（仅在 mysql service 内）
set -e
cd /opt/ftg/deploy
cp docker-compose.yml docker-compose.yml.bak2

awk '
/container_name: docker-mysql/ { in_mysql=1 }
/^  [a-z]/ && !/^  mysql:/ && !/^    / && in_mysql && NR > 1 {
  if (inserted==0) {
    print "    command:"
    print "      - --innodb-buffer-pool-size=64M"
    print "      - --innodb-log-buffer-size=8M"
    print "      - --max-connections=50"
    print "      - --performance-schema=OFF"
    print "      - --table-open-cache=256"
    print "      - --innodb-buffer-pool-instances=1"
    inserted=1
  }
  in_mysql=0
}
/start_period: 30s/ && in_mysql && !inserted {
  print
  print "    command:"
  print "      - --innodb-buffer-pool-size=64M"
  print "      - --innodb-log-buffer-size=8M"
  print "      - --max-connections=50"
  print "      - --performance-schema=OFF"
  print "      - --table-open-cache=256"
  print "      - --innodb-buffer-pool-instances=1"
  inserted=1
  next
}
{ print }
' docker-compose.yml > docker-compose-new.yml

mv docker-compose-new.yml docker-compose.yml

echo "=== MySQL command 插入结果 ==="
grep -A 8 "buffer-pool" docker-compose.yml
echo ""
echo "=== 其他服务不应有 command ==="
grep -c "pool-size" docker-compose.yml
echo "(上面数字应为 1 — 表示只在 MySQL 出现一次)"
