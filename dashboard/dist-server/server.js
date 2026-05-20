"use strict";
// =============================================================================
// Dashboard Admin API Server Entry Point
// 为 Dashboard 提供独立的管理员认证 API 服务
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("./prisma"));
const admin_auth_1 = __importDefault(require("./admin-auth"));
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const admin_food_records_1 = __importDefault(require("./admin-food-records"));
const admin_api_keys_1 = __importDefault(require("./admin-api-keys"));
const admin_achievements_1 = __importDefault(require("./admin-achievements"));
const agent_routes_1 = __importDefault(require("./agent-routes"));
const admin_monitoring_1 = __importDefault(require("./admin-monitoring"));
const game1_proxy_1 = __importDefault(require("./routes/game1-proxy"));
const tavern_proxy_1 = __importDefault(require("./routes/tavern-proxy"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.ADMIN_PORT || '3001', 10);
app.use(express_1.default.json({ limit: '1mb' }));
// 挂载管理员认证路由
app.use('/api/admin', admin_auth_1.default);
// 挂载仪表盘统计路由（/api/admin/dashboard/*）
// 统一在 /api/admin 下，方便前端使用单一 baseURL 访问所有 Admin API
app.use('/api/admin/dashboard', dashboardRoutes_1.default);
// 挂载食物记录管理路由（/api/admin/food-records/*）
app.use('/api/admin/food-records', admin_food_records_1.default);
// 挂载 API 密钥管理路由（/api/admin/api-keys/*）
app.use('/api/admin/api-keys', admin_api_keys_1.default);
// 挂载成就管理路由（/api/admin/achievements/*）
app.use('/api/admin/achievements', admin_achievements_1.default);
// 挂载 AGENT 调试通道（/api/admin/agent/*）
app.use('/api/admin/agent', agent_routes_1.default);
// 挂载监控路由（/api/admin/monitoring/*）
app.use('/api/admin/monitoring', admin_monitoring_1.default);
// 挂载 Game1 代理路由（/api/admin/game1/* → game1-server）
app.use('/api/admin', game1_proxy_1.default);
// 挂载 Tavern 代理路由（/api/admin/tavern/* → tavern-server）
app.use('/api/admin', tavern_proxy_1.default);
// 健康检查端点
app.get('/health', async (_req, res) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        const adminCount = await prisma_1.default.adminUser.count();
        res.json({ status: 'ok', service: 'dashboard-admin', db: 'connected', admins: adminCount });
    }
    catch {
        res.status(503).json({ status: 'degraded', service: 'dashboard-admin', db: 'disconnected' });
    }
});
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dashboard Admin API running on port ${PORT}`);
});
// 与 Nginx 保持长连接复用，防止每个请求新建 TCP 连接
server.keepAliveTimeout = 65 * 1000; // 65s，匹配 Nginx keepalive_timeout
server.headersTimeout = 70 * 1000; // 70s，必须大于 keepAliveTimeout
server.timeout = 30 * 1000; // 30s 请求超时，防止慢请求占用连接
