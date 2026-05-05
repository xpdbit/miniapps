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
      // Admin API 代理 — 优先匹配 /api/admin，转发到 Dashboard Admin API (3001)
      '/api/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Dashboard 统计路由 — 转发到 Admin API
      '/dashboard': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // 主 API 代理 — /api/* 转发到 ftg-server (3000)
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
