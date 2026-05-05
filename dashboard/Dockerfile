# ============================================================
# Stage 1: 构建阶段
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1) 安装依赖（利用 Docker 缓存层）
COPY package.json package-lock.json ./
RUN npm ci

# 2) 复制源码并构建
COPY . .
RUN npm run build

# ============================================================
# Stage 2: 运行阶段（仅 Nginx）
# ============================================================
FROM nginx:1.25-alpine

# 1) 复制 Nginx 配置
COPY nginx/dashboard.conf /etc/nginx/conf.d/default.conf

# 2) 从构建阶段复制产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 3) 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# 4) 非 root 用户运行（安全）
RUN sed -i 's/user  nginx;/user  nginx;/' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
