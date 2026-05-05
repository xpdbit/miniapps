#!/bin/bash
set -e

echo "=========================================="
echo " FTG Dashboard 部署"
echo "=========================================="

# 1. 构建 Dashboard 前端
echo ""
echo "[1/5] 构建 Dashboard 前端..."
cd /opt/ftg/dashboard
npm run build 2>&1 | tail -5
echo "构建完成: $(ls dist/ | wc -l) 个文件"

# 2. 复制构建产物到 Nginx
echo ""
echo "[2/5] 复制到 Nginx 部署目录..."
rm -rf /opt/ftg/deploy/nginx/html/*
cp -r dist/* /opt/ftg/deploy/nginx/html/
echo "复制完成"

# 3. 重建 Docker 容器
echo ""
echo "[3/5] 启动 Docker 容器..."
cd /opt/ftg/deploy
# 使用现有镜像快速启动（先保证服务可用，后续可再加 --build 重建）
docker compose --env-file .env up -d 2>&1 | tail -10

# 4. 初始化 Dashboard Admin 数据库（在容器内执行）
echo ""
echo "[4/5] 初始化 Dashboard Admin 数据库..."
sleep 10
echo "等待 MySQL 就绪..."
for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' ftg-mysql 2>/dev/null | grep -q healthy; then
        break
    fi
    sleep 2
done
echo "执行数据库迁移..."
docker compose --env-file .env exec -T admin npx prisma db push --accept-data-loss 2>&1 | tail -5
echo "数据库表结构已同步"
docker compose --env-file .env exec -T admin npx prisma db seed 2>&1
echo "管理员种子数据已检查"

# 5. 验证
echo ""
echo "[5/5] 等待服务启动..."
sleep 5
echo ""
echo "容器状态:"
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo ""
echo "健康检查:"
curl -s http://localhost/api/admin/health 2>/dev/null || echo "Admin API 启动中..."
curl -s -o /dev/null -w "Nginx: HTTP %{http_code}\n" http://localhost/ 2>/dev/null || echo "Nginx 启动中..."
echo ""
echo "=========================================="
echo " 部署完成!"
echo "=========================================="
