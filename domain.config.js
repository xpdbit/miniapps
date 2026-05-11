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
const IP = '47.94.108.150';

// =============================================================================
// ─── 项目配置 ─────────────────────────────────────────────────────────────────
// =============================================================================
const config = {
  // ─── 主域名 ───
  DOMAIN,
  IP,

  // ─── FTG 项目 ───
  // 小程序前端 API_BASE + 服务端 CORS 白名单
  FTG: {
    // 开发测试（DevTools 勾「不校验」即可）
    DEV: `http://${IP}/api/v1`,
    // 生产（ICP 备案后生效）
    PROD: `https://${DOMAIN}/api/ftl/api/v1`,
    // 服务端 CORS 允许来源
    CORS: [
      `https://${DOMAIN}`,
      `https://ftl.${DOMAIN}`,
      `https://game1.${DOMAIN}`,
      `http://${IP}`,
      `https://${IP}`,
    ],
  },

  // ─── Game1 项目 ───
  GAME1: {
    DEV: `http://${IP}/api/v1/game1`,
    PROD: `https://${DOMAIN}/api/v1/game1`,
  },

  // ─── AI-Tavern 项目 ───
  TAVERN: {
    // 开发测试（通过域名访问，需要 DNS 或 hosts 指向服务器）
    DEV: `http://${DOMAIN}/api/tavern/api/v1`,
    // 生产（ICP 备案后生效）
    PROD: `https://${DOMAIN}/api/tavern/api/v1`,
  },

  // ─── 全部域名列表（nginx/deploy 用） ───
  ALL_DOMAINS: [
    DOMAIN,
    `ftl.${DOMAIN}`,
    `www.${DOMAIN}`,
    `game1.${DOMAIN}`,
  ],
};

module.exports = config;
