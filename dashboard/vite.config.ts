import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // ─── ！重要：代理规则按定义顺序匹配 ───
      // 更具体的规则必须放在前面，否则会被通用规则抢匹配
      // ─────────────────────────────────────────

      // Admin API 代理 — 必须放在 /api 之前
      // 匹配 /api/admin/*，转发到 Dashboard Admin API (3001)
      '/api/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // 统一认证 API — 由 Dashboard Admin API (3001) 处理，非 ftg-server
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Tavern API 代理 — 转发到 Tavern Server (3002)
      // 匹配 /api/tavern/*，rewrite 为 /api/* 后转发（与生产 Nginx 路由对齐）
      '/api/tavern': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tavern/, '/api'),
      },
      // Game1 API 代理 — 转发到 Game1 Server (3004)
      // 匹配 /api/v1/game1/*，与生产 Nginx 路由对齐
      '/api/v1/game1': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
      // 主 API 代理 — /api/* 转发到 ftg-server (3000)
      // 必须放在所有更具体的 /api/* 规则之后
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 生产环境关闭 sourcemap
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 antd 相关库拆分为独立 chunk
          'antd-vendor': ['antd', '@ant-design/icons'],
          // 图表库独立
          charts: ['@ant-design/charts'],
          // 将 react 相关库拆分
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // 限制 CSS 内联大小（避免 runtime injection）
    cssCodeSplit: true,
  },
}))
