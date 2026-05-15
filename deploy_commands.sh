#!/bin/bash
set -e

echo "=========================================="
echo " FTG Dashboard 部署 + SSL 证书自动配置"
echo "=========================================="

# 0. 预检：确保 SSL 凭证文件已存在
echo ""
echo "[0/6] 检查 SSL 配置..."
if [ -f /opt/ftg/deploy/nginx/aliyun-credentials.ini ]; then
    echo "阿里云 DNS 凭证: 已就绪"
else
    echo "⚠️  阿里云 DNS 凭证文件不存在，SSL 自动配置将跳过"
    echo "   请先复制文件："
    echo "   scp deploy/nginx/aliyun-credentials.ini root@mnapp.top:/opt/ftg/deploy/nginx/"
    echo "   scp deploy/scripts/setup-ssl.sh root@mnapp.top:/opt/ftg/deploy/scripts/"
fi

# 1. 构建 Dashboard 前端
echo ""
echo "[1/6] 构建 Dashboard 前端..."
cd /opt/ftg/dashboard
npm run build 2>&1 | tail -5
echo "构建完成: $(ls dist/ | wc -l) 个文件"

# 2. 复制构建产物到 Nginx
echo ""
echo "[2/6] 复制到 Nginx 部署目录..."
rm -rf /opt/ftg/deploy/nginx/html/*
cp -r dist/* /opt/ftg/deploy/nginx/html/
echo "复制完成"

# 3. 重建 Docker 容器（含最新的 nginx.conf，扩展了 cipher 列表）
echo ""
echo "[3/6] 启动 Docker 容器..."
cd /opt/ftg/deploy
docker compose --env-file .env up -d --build 2>&1 | tail -10

# 4. 初始化 Dashboard Admin 数据库
echo ""
echo "[4/6] 初始化 Dashboard Admin 数据库..."
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

# 4b. AI Tavern 数据库 — 确保 ai_tavern 库存在（已有数据卷不会重新执行 init-db.sql）
echo "确保 ai_tavern 数据库存在..."
docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e \
  "CREATE DATABASE IF NOT EXISTS ai_tavern CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON ai_tavern.* TO 'ftg_user'@'%'; FLUSH PRIVILEGES;" 2>&1 || echo "⚠️  数据库创建可能失败（可手动执行）"

echo "执行 AI Tavern Server 数据库迁移..."
docker compose --env-file .env exec -T tavern-server npx prisma db push --accept-data-loss 2>&1 | tail -10 || echo "⚠️  tavern迁移可能失败，请检查日志"
echo "AI Tavern 数据库表结构已同步"
docker compose --env-file .env exec -T tavern-server npx tsx prisma/seed.ts 2>&1 | tail -10 || echo "⚠️  tavern种子数据可能已存在"

# 5. SSL 证书自动配置（通过 DNS-01 验证，无需开放 80 端口）
#    使用阿里云 DNS API 自动获取 Let's Encrypt 通配符证书
echo ""
echo "[5/6] SSL 证书自动配置..."
if [ -f /opt/ftg/deploy/scripts/setup-ssl.sh ]; then
    # 设置阿里云 DNS API 凭证（从 deploy/.env 读取）
    source /opt/ftg/deploy/.env 2>/dev/null || true
    
    if [ -n "${ALIYUN_AK:-}" ] && [ -n "${ALIYUN_SK:-}" ]; then
        # 导出为 acme.sh 所需的格式
        export Ali_Key="$ALIYUN_AK"
        export Ali_Secret="$ALIYUN_SK"
        
        # 检查是否已有 Let's Encrypt 证书
        if [ -f /opt/ftg/deploy/nginx/ssl/fullchain.pem ]; then
            # 检查证书是否由 CA 签发（不是自签名）
            ISSUER=$(openssl x509 -in /opt/ftg/deploy/nginx/ssl/fullchain.pem -noout -issuer 2>/dev/null)
            SUBJECT=$(openssl x509 -in /opt/ftg/deploy/nginx/ssl/fullchain.pem -noout -subject 2>/dev/null)
            if [ "$ISSUER" != "$SUBJECT" ]; then
                echo "已有 CA 签发证书，跳过 SSL 配置"
            else
                echo "当前为自签名证书，正在获取 Let's Encrypt 证书..."
                bash /opt/ftg/deploy/scripts/setup-ssl.sh 2>&1 | tail -20
            fi
        else
            echo "正在获取 Let's Encrypt 证书..."
            bash /opt/ftg/deploy/scripts/setup-ssl.sh 2>&1 | tail -20
        fi
    else
        echo "⚠️  阿里云 DNS 凭证未配置，跳过 SSL 自动配置"
        echo "   请编辑 /opt/ftg/deploy/.env 填入 ALIYUN_AK / ALIYUN_SK"
        echo "   或手动运行: bash /opt/ftg/deploy/scripts/setup-ssl.sh"
    fi
else
    echo "⚠️  setup-ssl.sh 不存在，跳过 SSL 配置"
    echo "   请复制脚本: scp deploy/scripts/setup-ssl.sh root@mnapp.top:/opt/ftg/deploy/scripts/"
fi

# 6. 验证
echo ""
echo "[6/6] 等待服务启动并验证..."
sleep 5

echo ""
echo "容器状态:"
docker ps --format 'table {{.Names}}\t{{.Status}}'

echo ""
echo "健康检查:"
curl -s http://localhost/api/admin/health 2>/dev/null || echo "Admin API 启动中..."
curl -s -o /dev/null -w "Nginx HTTP: %{http_code}\n" http://localhost/ 2>/dev/null || echo "Nginx 启动中..."
curl -s -o /dev/null -w "Nginx HTTPS: %{http_code}\n" https://localhost/health --connect-timeout 5 2>/dev/null || echo "HTTPS 启动中..."
# AI Tavern 健康检查
TAVERN_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/tavern/health --connect-timeout 5 2>/dev/null || echo "000")
echo "Tavern API: HTTP ${TAVERN_HEALTH} $( [ "$TAVERN_HEALTH" = "200" ] && echo '✅' || echo '⚠️' )"

echo ""
echo "=========================================="
echo " 部署完成!"
echo "=========================================="
echo ""
echo "如果 HTTPS 仍未就绪，请手动在服务器上运行："
echo "  bash /opt/ftg/deploy/scripts/setup-ssl.sh"
echo ""
echo "微信小程序配置检查清单："
echo "  1. mp.weixin.qq.com → 开发管理 → request合法域名:"
echo "     https://mnapp.top"
echo "  2. /opt/ftg/deploy/.env → WECHAT_SECRET 已填写"
echo "  3. 小程序构建: cd apps/ftg/h5-weapp && npm run build:weapp:prod"
