/**
 * =============================================================================
 * 编译时通用配置 — 切换环境只需改这里
 * =============================================================================
 *
 * 用途：
 *   所有 Taro 项目的构建配置通过 require('../../domain.config.js') 读取此文件，
 *   将 API_BASE 等域名字符串注入到 defineConstants 中。
 *   环境变量 TARO_APP_API_BASE 优先级最高，可在 CI/CD 时覆盖。
 *
 * 使用方式（Taro config/*.ts）：
 *   const domain = require('../../../domain.config.js');
 *   const apiBase = process.env.TARO_APP_API_BASE || domain.FTG.DEV;
 *
 * 切换环境：
 *   ICP 备案前（开发测试） → IP + HTTP（DevTools 勾「不校验合法域名」）
 *   ICP 备案后（生产）    → 域名 + HTTPS（微信白名单 + ZeroSSL 证书）
 *
 * 注意：
 *   - 此文件是构建时的 Node.js 配置，不会被打包到小程序中
 *   - 运行时通过 buildConfig.defineConstants 将值注入 process.env
 *   - 部署脚本（deploy/*）有自己的 .env 文件，不引用此文件
 * =============================================================================
 */

// =============================================================================
// ─── 域名/IP 基础定义 ─────────────────────────────────────────────────────────
// =============================================================================
const DOMAIN = 'mnapp.top';
// const IP = '47.94.108.150'; // 已迁移至域名，保留注释作为历史记录

// =============================================================================
// ─── 项目配置 ─────────────────────────────────────────────────────────────────
// =============================================================================
// =============================================================================
// ─── 本地开发端口 ───────────────────────────────────────────────────────────
// 本地各 Server 用 npm run dev 直接暴露的端口（不经过 Nginx）
// =============================================================================
// FTG Server:  3000  (apps/ftg/server)
// Game1 Server: 3004  (apps/game1/server，改端口避免与 Dashboard Admin 3001 冲突)
// Tavern Server: 3002  (apps/tavern/server)
// Tavern H5 Web: 5174  (apps/tavern/client, npm run dev:web)
// Dashboard Admin: 3001 (dashboard, tsx server/server.ts)
// Dashboard Front: 5173 (dashboard, npm run dev)
// =============================================================================
const LOCAL = {
  FTG: `http://localhost:3000/api/v1`,
  GAME1: `http://localhost:3004/api/v1/game1`,
  TAVERN: `http://localhost:3002/api/v1/tavern`,
};

const config = {
  // ─── 主域名 ───
  DOMAIN,

  // ─── 本地开发地址（开发者工具 HTTP 直连） ───
  // 使用方式：npm run dev:weapp 时自动使用
  // 若需真机调试（HTTPS 必需），设环境变量 TARO_APP_API_BASE=https://mnapp.top/...
  LOCAL,

  // ─── FTG 项目 ───
  // 小程序前端 API_BASE + 服务端 CORS 白名单
  FTG: {
    // 本地开发（DevTools 中 HTTP 可用，无需 HTTPS）
    DEV: LOCAL.FTG,
    // 生产 + 真机调试（HTTPS 通过 Nginx /api/ftl/ 前缀路由）
    PROD: `https://${DOMAIN}/api/v1/ftl`,
    // 服务端 CORS 允许来源
    CORS: [
      `https://${DOMAIN}`,
      `https://ftl.${DOMAIN}`,
      `https://game1.${DOMAIN}`,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:3004',
      'http://localhost:3002',
    ],
  },

  // ─── Game1 项目 ───
  GAME1: {
    // 本地开发
    DEV: LOCAL.GAME1,
    // 生产（Nginx /api/v1/game1/ 路由）
    PROD: `https://${DOMAIN}/api/v1/game1`,
  },

  // ─── AI-Tavern 项目 ───
  TAVERN: {
    // 本地开发
    DEV: LOCAL.TAVERN,
    // 生产（Nginx /api/v1/tavern/ 路由）
    PROD: `https://${DOMAIN}/api/v1/tavern`,
  },

  // ─── 全部域名列表（nginx/deploy 用） ───
  ALL_DOMAINS: [
    DOMAIN,
    `ftl.${DOMAIN}`,
    `www.${DOMAIN}`,
    `game1.${DOMAIN}`,
  ],

  // ─── 本地全部端口（start-all.ps1 用） ───
  LOCAL_PORTS: {
    FTG: 3000,
    GAME1: 3004,
    TAVERN: 3002,
    TAVERN_H5: 5174,
    ADMIN: 3001,
    FRONT: 5173,
  },
};

module.exports = config;
