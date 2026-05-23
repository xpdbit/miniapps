#!/bin/bash
# =============================================================================
# mnapp.top 服务器恢复 + 部署脚本
# 用于服务器 Docker 容器全部停止后的恢复操作
# 使用方式：ssh root@mnapp.top "bash -s" < recover_and_deploy.sh
# =============================================================================
set -e

echo "=========================================="
echo " mnapp.top 服务器恢复与部署"
echo "=========================================="

# ─── Step 1: 检查 Docker 状态 ────────────────────────────────────────
echo ""
echo "[1/8] 检查 Docker 状态..."
if ! docker info &>/dev/null; then
    echo "Docker 服务未运行，尝试启动..."
    systemctl start docker
    sleep 5
fi
echo "Docker 运行正常"

# ─── Step 2: SSL 证书检查 ──────────────────────────────────────────
echo ""
echo "[2/8] 检查 SSL 证书..."
CERT_FILE="/opt/ftg/deploy/nginx/ssl/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
    EXPIRY=$(openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | cut -d= -f2)
    ISSUER=$(openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null)
    SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject 2>/dev/null)
    if [ -n "$EXPIRY" ]; then
        EXPIRY_CLEAN=$(echo "$EXPIRY" | sed 's/ GMT$//')
        EXPIRY_EPOCH=$(date -d "$EXPIRY_CLEAN" +%s 2>/dev/null) || EXPIRY_EPOCH=0
        NOW_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
        echo "  证书签发者: $(echo "$ISSUER" | sed 's/issuer=//')"
        echo "  证书状态: $([ "$DAYS_LEFT" -gt 30 ] && echo '✅ 有效' || ([ "$DAYS_LEFT" -gt 0 ] && echo "⚠️ ${DAYS_LEFT}天后过期" || echo '❌ 已过期'))"
        echo "  剩余: $([ "$DAYS_LEFT" -gt 0 ] && echo "$DAYS_LEFT 天" || echo '已过期')"
        if [ "$DAYS_LEFT" -le 0 ]; then
            echo "  → 证书已过期，Nginx entrypoint 将自动降级为自签名证书"
        fi
    fi
else
    echo "  ⚠️ SSL 证书文件不存在，Nginx 入口点将自动生成自签名证书"
fi

# ─── Step 3: 构建 Dashboard SPA ─────────────────────────────────────
echo ""
echo "[3/8] 构建 Dashboard SPA..."
cd /opt/ftg/dashboard
if [ -f "package.json" ]; then
    npm run build 2>&1 | tail -10
    echo "构建完成: $(ls dist/ | wc -l) 个文件"
    # 复制构建产物到 Nginx 部署目录
    echo "复制到 Nginx 部署目录..."
    rm -rf /opt/ftg/deploy/nginx/html/*
    cp -r dist/* /opt/ftg/deploy/nginx/html/
    echo "复制完成 ($(find /opt/ftg/deploy/nginx/html -type f | wc -l) 个文件)"
else
    echo "⚠️  Dashboard 源码目录不存在（/opt/ftg/dashboard），跳过构建"
    echo "   请手动构建后复制到 deploy/nginx/html/"
fi

# ─── Step 4: 启动所有容器（重建关键镜像以应用配置/代码修复） ────
echo ""
echo "[4/8] 启动 Docker 容器..."
cd /opt/ftg/deploy
# 重建 nginx + tavern-server 镜像以应用最新的配置和源码修复
docker compose --env-file .env up -d --build nginx tavern-server 2>&1 | tail -10
# 启动其他服务（使用现有镜像）
docker compose --env-file .env up -d 2>&1 | tail -10

# ─── Step 5: 等待 MySQL 就绪 ───────────────────────────────────────
echo ""
echo "[5/8] 等待 MySQL 就绪..."
for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' ftg-mysql 2>/dev/null | grep -q healthy; then
        echo "MySQL 已就绪"
        break
    fi
    echo "  等待中... ($i/30)"
    sleep 3
done

# ─── Step 6: 数据库迁移 ─────────────────────────────────────────────
echo ""
echo "[6/8] 数据库迁移..."

echo "→ Dashboard Admin..."
docker compose --env-file .env exec -T admin npx prisma db push --schema=../prisma/schema-miniapps.prisma --accept-data-loss 2>&1 | tail -5
docker compose --env-file .env exec -T admin npx prisma db seed --schema=../prisma/schema-miniapps.prisma 2>&1

echo "→ 确保 ai_tavern 数据库存在..."
docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e \
  "CREATE DATABASE IF NOT EXISTS ai_tavern CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON ai_tavern.* TO 'ftg_user'@'%'; FLUSH PRIVILEGES;" 2>&1 || echo "⚠️  数据库创建可能失败"

echo "→ AI Tavern Server..."
docker compose --env-file .env exec -T tavern-server npx prisma db push --accept-data-loss 2>&1 | tail -10 || echo "⚠️  tavern迁移可能失败，请检查日志"
docker compose --env-file .env exec -T tavern-server npx tsx prisma/seed.ts 2>&1 | tail -10 || echo "⚠️  tavern种子数据可能已存在"

echo "→ FTG Server..."
docker compose --env-file .env exec -T server npx prisma db push --schema=../../prisma/schema-food-theme-generator.prisma --accept-data-loss 2>&1 | tail -5 || echo "FTG db push may fail"

echo "→ Game1 Server..."
docker compose --env-file .env exec -T game1-server npx prisma db push --schema=../../prisma/schema-game1.prisma --accept-data-loss 2>&1 | tail -5 || true

echo ""

# ─── Step 7: SSL 续期检查 ──────────────────────────────────────────
echo ""
echo "[7/8] 尝试 SSL 证书续期..."
if command -v acme.sh &>/dev/null; then
    echo "  检测到 acme.sh，尝试续签..."
    acme.sh --renew -d "*.mnapp.top" --dns dns_ali --force 2>&1 | tail -5 || echo "  续签失败（可能无阿里云凭证），降级为自签名证书"
else
    echo "  未安装 acme.sh，Nginx entrypoint 会在启动时自动生成自签名证书"
fi

# ─── Step 8: 验证 ──────────────────────────────────────────────────
echo ""
echo "[8/8] 验证部署..."
sleep 10
echo ""
echo "=== 容器状态 ==="
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo ""

echo "=== 健康检查 ==="
echo -n "HTTP Dashboard: "
DASH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
echo "HTTP ${DASH_CODE} $( [ "$DASH_CODE" = "200" ] && echo '✅' || echo '⚠️' )"
echo -n "HTTPS Dashboard: "
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://localhost/ --connect-timeout 5 -k 2>/dev/null || echo "000")
echo "HTTPS ${HTTPS_CODE} $( [ "$HTTPS_CODE" -ge 200 ] && [ "$HTTPS_CODE" -lt 400 ] && echo '✅' || echo '⚠️' )"
echo -n "SPA 资源校验: "
# 从 index.html 提取所有 /assets/ 引用，检查文件是否存在
HTML_FILE="/opt/ftg/deploy/nginx/html/index.html"
if [ -f "$HTML_FILE" ]; then
    MISSING_COUNT=0
    TOTAL_COUNT=0
    for asset in $(grep -oP '/assets/[^"'"'"']+' "$HTML_FILE" 2>/dev/null | sort -u); do
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if [ ! -f "/opt/ftg/deploy/nginx/html${asset}" ]; then
            echo "  ❌ 缺失: ${asset}"
            MISSING_COUNT=$((MISSING_COUNT + 1))
        fi
    done
    if [ "$MISSING_COUNT" -eq 0 ]; then
        echo "✅ 全部 ${TOTAL_COUNT} 个资源文件存在"
    else
        echo "⚠️  缺失 ${MISSING_COUNT}/${TOTAL_COUNT} 个资源文件"
    fi
else
    echo "⚠️  index.html 不存在"
fi
echo -n "Admin API: "
ADMIN_CODE=$(curl -s http://localhost/api/admin/health 2>/dev/null && echo "" || echo "未就绪")
echo -n "登录测试: "
curl -s -X POST http://localhost/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"Admin123!"}' 2>/dev/null | head -c 100
echo ""
echo -n "Tavern API: "
TAVERN_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/tavern/health --connect-timeout 5 2>/dev/null || echo "000")
echo "HTTP ${TAVERN_CODE} $( [ "$TAVERN_CODE" = "200" ] && echo '✅' || echo '⚠️' )"

echo ""
echo "=========================================="
echo " 恢复完成!"
echo "=========================================="
echo " Dashboard:  https://mnapp.top/"
echo " API:        https://mnapp.top/api/ftl/api/v1/"
echo " Game1:      https://game1.mnapp.top/"
echo " 默认管理员: admin / Admin123!"
echo "=========================================="
