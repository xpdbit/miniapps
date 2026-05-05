#!/bin/bash
# =============================================================================
# FTG 服务器恢复 + 部署脚本
# 用于服务器 Docker 容器全部停止后的恢复操作
# 使用方式：ssh root@47.94.108.150 "bash -s" < recover_and_deploy.sh
# =============================================================================
set -e

echo "=========================================="
echo " FTG 服务器恢复与部署"
echo "=========================================="

# ─── Step 1: 检查 Docker 状态 ───────────────────────────────────────
echo ""
echo "[1/5] 检查 Docker 状态..."
if ! docker info &>/dev/null; then
    echo "Docker 服务未运行，尝试启动..."
    systemctl start docker
    sleep 5
fi
echo "Docker 运行正常"

# ─── Step 2: 启动所有容器（不重建，使用现有镜像，快速恢复） ────
echo ""
echo "[2/5] 启动 Docker 容器（使用现有镜像，快速恢复）..."
cd /opt/ftg/deploy
# 先用现有镜像快速启动（不重建，避免 tsc 编译失败阻隔）
docker compose --env-file .env up -d 2>&1 | tail -10

# ─── Step 3: 等待 MySQL 就绪 ───────────────────────────────────────
echo ""
echo "[3/5] 等待 MySQL 就绪..."
for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' ftg-mysql 2>/dev/null | grep -q healthy; then
        echo "MySQL 已就绪"
        break
    fi
    echo "  等待中... ($i/30)"
    sleep 3
done

# ─── Step 4: 初始化 Admin 数据库 ────────────────────────────────────
echo ""
echo "[4/5] 初始化 Dashboard Admin 数据库..."
docker compose --env-file .env exec -T admin npx prisma db push --accept-data-loss 2>&1 | tail -5
echo ""
docker compose --env-file .env exec -T admin npx prisma db seed 2>&1
echo ""

# ─── Step 5: 验证 ──────────────────────────────────────────────────
echo ""
echo "[5/5] 验证部署..."
sleep 10
echo ""
echo "=== 容器状态 ==="
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo ""

echo "=== 健康检查 ==="
echo -n "Admin API: "
curl -s http://localhost/api/admin/health 2>/dev/null && echo "" || echo "未就绪"
echo -n "登录测试: "
curl -s -X POST http://localhost/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"Admin123!"}' 2>/dev/null | head -c 100
echo ""
echo -n "Nginx: "
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost/ 2>/dev/null && echo "" || echo "未就绪"

echo ""
echo "=========================================="
echo " 恢复完成! 访问 https://47.94.108.150/"
echo " 默认管理员: admin / Admin123!"
echo "=========================================="
