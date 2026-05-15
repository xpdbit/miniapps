# SSL 证书目录

将你的 SSL 证书放置在此目录：

- `fullchain.pem` — 完整的证书链（含中间证书）
- `privkey.pem` — 私钥文件

## 使用 Certbot 自动申请（推荐）

```bash
# 首次启动 nginx（仅 HTTP）
docker compose --env-file .env.production up -d nginx

# 进入 nginx 容器执行 certbot
docker compose exec nginx certbot --nginx -d your-domain.com --agree-tos -m your-email@example.com

# 证书会自动续签（certbot 已安装，定时任务会自动处理）
```

## 手动证书（自签名，仅用于开发测试）

```bash
# 生成自签名证书（开发环境用）
docker compose exec nginx openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/privkey.pem \
  -out /etc/nginx/ssl/fullchain.pem \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=FTG/CN=localhost"
```
