"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
const TAVERN_API = process.env.TAVERN_API_URL || 'http://tavern-server:3002/api/v1';
const TAVERN_ADMIN_TOKEN = process.env.TAVERN_ADMIN_TOKEN || '';
if (!TAVERN_ADMIN_TOKEN) {
    console.warn('[Tavern Proxy] TAVERN_ADMIN_TOKEN not set — relying on dashboard JWT passthrough');
}
/**
 * 统一代理处理：转换路径 + 认证
 * 前端请求：/api/admin/tavern/pending
 * Express 挂载在 /api/admin，req.path = /tavern/pending
 * 所有仪表盘接口均为 tavern-server 的管理接口（前缀 /admin/），
 * 所以目标 URL = {TAVERN_API}/admin/pending
 *
 * 认证：如果配置了 TAVERN_ADMIN_TOKEN，用它替换 Authorization header。
 * 否则透传用户的 dashboard JWT（不兼容 tavern-server requireAdmin, 需配置一致）。
 */
async function proxyRequest(req, res, method) {
    try {
        const subPath = req.path.replace(/^\/tavern\//, '');
        // tavern-server 管理接口统一在 /api/v1/admin/ 下
        const targetUrl = `${TAVERN_API}/admin/${subPath}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (TAVERN_ADMIN_TOKEN) {
            headers['Authorization'] = `Bearer ${TAVERN_ADMIN_TOKEN}`;
        }
        else if (req.headers.authorization) {
            headers['Authorization'] = req.headers.authorization;
        }
        const response = await (0, axios_1.default)({
            method,
            url: targetUrl,
            headers,
            params: method === 'get' ? req.query : undefined,
            data: ['post', 'put'].includes(method) ? req.body : undefined,
            timeout: 10000,
            validateStatus: () => true,
        });
        res.status(response.status).json(response.data);
    }
    catch (err) {
        const error = err;
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            res.status(502).json({ success: false, message: `Tavern server unreachable: ${error.message}` });
        }
        else {
            res.status(error.response?.status ?? 500).json(error.response?.data ?? { success: false, message: 'Proxy error' });
        }
    }
}
router.use('/tavern', (req, res) => {
    const method = req.method.toLowerCase();
    if (['get', 'post', 'put', 'delete'].includes(method)) {
        void proxyRequest(req, res, method);
    }
    else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
});
exports.default = router;
