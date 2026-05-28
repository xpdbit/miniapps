#!/bin/bash
# ECS 内存优化修复 — MySQL 调优 + 镜像清理
set -e

echo "=== ECS 内存优化 ==="

# 1. 备份原 compose
cp /opt/ftg/deploy/docker-compose.yml /opt/ftg/deploy/docker-compose.yml.bak.$(date +%s)

# 2. 检查是否已有 command（避免重复插入）
if grep -q "innodb-buffer-pool-size" /opt/ftg/deploy/docker-compose.yml; then
  echo "[SKIP] MySQL 调优参数已存在"
else
  echo "[1/4] 添加 MySQL 内存调优参数..."
  # 在 deploy.resources.limits 之前插入 command（更精确的定位）
  sed -i '/deploy:/i\    command:\n      - --innodb-buffer-pool-size=64M\n      - --innodb-log-buffer-size=8M\n      - --max-connections=50\n      - --performance-schema=OFF\n      - --table-open-cache=256\n      - --innodb-buffer-pool-instances=1' /opt/ftg/deploy/docker-compose.yml
  echo "  已添加 MySQL 调优参数"
fi

# 3. 清理废弃镜像
echo "[2/4] 清理废弃 Docker 镜像..."
docker image prune -af 2>&1 | tail -3
docker builder prune -f 2>&1 | tail -1

# 4. 重建 MySQL 容器（应用新参数）
echo "[3/4] 重建 MySQL 容器..."
cd /opt/ftg/deploy
docker compose --env-file .env up -d --force-recreate mysql 2>&1 | tail -3
echo "  等待 MySQL 就绪..."
sleep 15

# 确保其他容器也运行
docker compose --env-file .env up -d 2>&1 | tail -3
sleep 5

# 5. 验证
echo ""
echo "============================================"
echo "[4/4] 验证结果"
echo "============================================"
echo "--- 容器资源 ---"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
echo ""
echo "--- 主机内存 ---"
free -m
echo ""
echo "--- 磁盘 ---"
df -h / | tail -1
echo ""
echo "--- 镜像 ---"
docker images --format 'table {{.Repository}}\t{{.Size}}' 2>/dev/null
echo ""
echo "============================================"
echo "DONE"
echo "============================================"
