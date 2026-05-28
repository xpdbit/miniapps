#!/bin/bash
set -e

echo "=========================================="
echo " FTG Dashboard 閮ㄧ讲 + SSL 璇佷功鑷姩閰嶇疆"
echo "=========================================="

# 0. 棰勬锛氱‘淇?SSL 鍑瘉鏂囦欢宸插瓨鍦?echo ""
echo "[0/6] 妫€鏌?SSL 閰嶇疆..."
if [ -f /opt/ftg/deploy/nginx/aliyun-credentials.ini ]; then
    echo "闃块噷浜?DNS 鍑瘉: 宸插氨缁?
else
    echo "鈿狅笍  闃块噷浜?DNS 鍑瘉鏂囦欢涓嶅瓨鍦紝SSL 鑷姩閰嶇疆灏嗚烦杩?
    echo "   璇峰厛澶嶅埗鏂囦欢锛?
    echo "   scp tools/deploy/nginx/aliyun-credentials.ini root@mnapp.top:/opt/ftg/deploy/nginx/"
    echo "   scp tools/deploy/scripts/setup-ssl.sh root@mnapp.top:/opt/ftg/deploy/scripts/"
fi

# 1. 鏋勫缓 Dashboard 鍓嶇
echo ""
echo "[1/6] 鏋勫缓 Dashboard 鍓嶇..."
cd /opt/ftg/dashboard
npm run build 2>&1 | tail -5
echo "鏋勫缓瀹屾垚: $(ls dist/ | wc -l) 涓枃浠?

# 2. 澶嶅埗鏋勫缓浜х墿鍒?Nginx
echo ""
echo "[2/6] 澶嶅埗鍒?Nginx 閮ㄧ讲鐩綍..."
rm -rf /opt/ftg/deploy/nginx/html/*
cp -r dist/* /opt/ftg/deploy/nginx/html/
echo "澶嶅埗瀹屾垚"

# 3. 閲嶅缓 Docker 瀹瑰櫒锛堝惈鏈€鏂扮殑 nginx.conf锛屾墿灞曚簡 cipher 鍒楄〃锛?echo ""
echo "[3/6] 鍚姩 Docker 瀹瑰櫒..."
cd /opt/ftg/deploy
docker compose --env-file .env up -d --build 2>&1 | tail -10

# 4. 鍒濆鍖?Dashboard Admin 鏁版嵁搴?echo ""
echo "[4/6] 鍒濆鍖?Dashboard Admin 鏁版嵁搴?.."
sleep 10
echo "绛夊緟 MySQL 灏辩华..."
for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' ftg-mysql 2>/dev/null | grep -q healthy; then
        break
    fi
    sleep 2
done
echo "鎵ц鏁版嵁搴撹縼绉?.."
docker compose --env-file .env exec -T admin npx prisma db push --schema=../prisma/schema-miniapps.prisma --accept-data-loss 2>&1 | tail -5
echo "miniapps DB synced"
docker compose --env-file .env exec -T admin npx prisma db seed --schema=../prisma/schema-miniapps.prisma 2>&1
echo "绠＄悊鍛樼瀛愭暟鎹凡妫€鏌?

# 4b. AI Tavern 鏁版嵁搴?鈥?纭繚 ai_tavern 搴撳瓨鍦紙宸叉湁鏁版嵁鍗蜂笉浼氶噸鏂版墽琛?init-db.sql锛?echo "纭繚 ai_tavern 鏁版嵁搴撳瓨鍦?.."
docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e \
  "CREATE DATABASE IF NOT EXISTS ai_tavern CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON ai_tavern.* TO 'ftg_user'@'%'; FLUSH PRIVILEGES;" 2>&1 || echo "鈿狅笍  鏁版嵁搴撳垱寤哄彲鑳藉け璐ワ紙鍙墜鍔ㄦ墽琛岋級"

echo "鎵ц AI Tavern Server 鏁版嵁搴撹縼绉?.."
docker compose --env-file .env exec -T tavern-server npx prisma db push --accept-data-loss 2>&1 | tail -10 || echo "鈿狅笍  tavern杩佺Щ鍙兘澶辫触锛岃妫€鏌ユ棩蹇?
echo "AI Tavern 鏁版嵁搴撹〃缁撴瀯宸插悓姝?
docker compose --env-file .env exec -T tavern-server npx tsx prisma/seed.ts 2>&1 | tail -10 || echo "tavern seed may exist"

echo "-> FTG Server..."
docker compose --env-file .env exec -T server npx prisma db push --schema=../../prisma/schema-food-theme-generator.prisma --accept-data-loss 2>&1 | tail -5 || echo "FTG db push may fail"

echo "-> Game1 Server..."
docker compose --env-file .env exec -T game1-server npx prisma db push --schema=../../prisma/schema-game1.prisma --accept-data-loss 2>&1 | tail -5 || true

# 5. SSL 璇佷功鑷姩閰嶇疆锛堥€氳繃 DNS-01 楠岃瘉锛屾棤闇€寮€鏀?80 绔彛锛?#    浣跨敤闃块噷浜?DNS API 鑷姩鑾峰彇 Let's Encrypt 閫氶厤绗﹁瘉涔?echo ""
echo "[5/6] SSL 璇佷功鑷姩閰嶇疆..."
if [ -f /opt/ftg/deploy/scripts/setup-ssl.sh ]; then
    # 璁剧疆闃块噷浜?DNS API 鍑瘉锛堜粠 deploy/.env 璇诲彇锛?    source /opt/ftg/deploy/.env 2>/dev/null || true
    
    if [ -n "${ALIYUN_AK:-}" ] && [ -n "${ALIYUN_SK:-}" ]; then
        # 瀵煎嚭涓?acme.sh 鎵€闇€鐨勬牸寮?        export Ali_Key="$ALIYUN_AK"
        export Ali_Secret="$ALIYUN_SK"
        
        # 妫€鏌ユ槸鍚﹀凡鏈?Let's Encrypt 璇佷功
        if [ -f /opt/ftg/deploy/nginx/ssl/fullchain.pem ]; then
            # 妫€鏌ヨ瘉涔︽槸鍚︾敱 CA 绛惧彂锛堜笉鏄嚜绛惧悕锛?            ISSUER=$(openssl x509 -in /opt/ftg/deploy/nginx/ssl/fullchain.pem -noout -issuer 2>/dev/null)
            SUBJECT=$(openssl x509 -in /opt/ftg/deploy/nginx/ssl/fullchain.pem -noout -subject 2>/dev/null)
            if [ "$ISSUER" != "$SUBJECT" ]; then
                echo "宸叉湁 CA 绛惧彂璇佷功锛岃烦杩?SSL 閰嶇疆"
            else
                echo "褰撳墠涓鸿嚜绛惧悕璇佷功锛屾鍦ㄨ幏鍙?Let's Encrypt 璇佷功..."
                bash /opt/ftg/deploy/scripts/setup-ssl.sh 2>&1 | tail -20
            fi
        else
            echo "姝ｅ湪鑾峰彇 Let's Encrypt 璇佷功..."
            bash /opt/ftg/deploy/scripts/setup-ssl.sh 2>&1 | tail -20
        fi
    else
        echo "鈿狅笍  闃块噷浜?DNS 鍑瘉鏈厤缃紝璺宠繃 SSL 鑷姩閰嶇疆"
        echo "   璇风紪杈?/opt/ftg/deploy/.env 濉叆 ALIYUN_AK / ALIYUN_SK"
        echo "   鎴栨墜鍔ㄨ繍琛? bash /opt/ftg/deploy/scripts/setup-ssl.sh"
    fi
else
    echo "鈿狅笍  setup-ssl.sh 涓嶅瓨鍦紝璺宠繃 SSL 閰嶇疆"
    echo "   请复制脚本: scp tools/deploy/scripts/setup-ssl.sh root@mnapp.top:/opt/ftg/deploy/scripts/"
fi

# 6. 楠岃瘉
echo ""
echo "[6/6] 绛夊緟鏈嶅姟鍚姩骞堕獙璇?.."
sleep 5

echo ""
echo "瀹瑰櫒鐘舵€?"
docker ps --format 'table {{.Names}}\t{{.Status}}'

echo ""
echo "鍋ュ悍妫€鏌?"
curl -s http://localhost/api/v1/admin/health 2>/dev/null || echo "Admin API 鍚姩涓?.."
curl -s -o /dev/null -w "Nginx HTTP: %{http_code}\n" http://localhost/ 2>/dev/null || echo "Nginx 鍚姩涓?.."
curl -s -o /dev/null -w "Nginx HTTPS: %{http_code}\n" https://localhost/health --connect-timeout 5 2>/dev/null || echo "HTTPS 鍚姩涓?.."
# AI Tavern 鍋ュ悍妫€鏌?TAVERN_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/tavern/health --connect-timeout 5 2>/dev/null || echo "000")
echo "Tavern API: HTTP ${TAVERN_HEALTH} $( [ "$TAVERN_HEALTH" = "200" ] && echo '鉁? || echo '鈿狅笍' )"

echo ""
echo "=========================================="
echo " 閮ㄧ讲瀹屾垚!"
echo "=========================================="
echo ""
echo "濡傛灉 HTTPS 浠嶆湭灏辩华锛岃鎵嬪姩鍦ㄦ湇鍔″櫒涓婅繍琛岋細"
echo "  bash /opt/ftg/deploy/scripts/setup-ssl.sh"
echo ""
echo "寰俊灏忕▼搴忛厤缃鏌ユ竻鍗曪細"
echo "  1. mp.weixin.qq.com 鈫?寮€鍙戠鐞?鈫?request鍚堟硶鍩熷悕:"
echo "     https://mnapp.top"
echo "  2. /opt/ftg/deploy/.env 鈫?WECHAT_SECRET 宸插～鍐?
echo "  3. 灏忕▼搴忔瀯寤? cd apps/ftg/client && npm run build:weapp:prod"
