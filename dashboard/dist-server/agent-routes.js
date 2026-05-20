"use strict";
// =============================================================================
// Agent Debug Routes — 为 AI Agent 提供诊断系统状态的调试通道
// 通过 x-agent-key 头认证（非 JWT，避免认证系统故障时无法诊断）
// =============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const router = (0, express_1.Router)();
// ─── Agent Auth Middleware ──────────────────────────────────────────
// 使用独立的 x-agent-key 头进行认证，不依赖 JWT，
// 以便在认证系统出现故障时仍能进行诊断
function agentAuth(req, res, next) {
    const agentKey = req.headers['x-agent-key'];
    const validKey = process.env.AGENT_API_KEY || process.env.JWT_SECRET || 'agent-dev-key';
    if (typeof agentKey !== 'string' || agentKey !== validKey) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    next();
}
// ─── Helper: Test Database Connectivity ────────────────────────────
async function checkDbConnection() {
    try {
        await prisma_1.default.$queryRawUnsafe('SELECT 1');
        return true;
    }
    catch {
        return false;
    }
}
// ─── GET /health — 基础健康检查 ──────────────────────────────────
router.get('/health', agentAuth, async (_req, res) => {
    try {
        const dbConnected = await checkDbConnection();
        let adminUsersCount = 0;
        if (dbConnected) {
            try {
                adminUsersCount = await prisma_1.default.adminUser.count();
            }
            catch {
                adminUsersCount = -1;
            }
        }
        res.json({
            timestamp: new Date().toISOString(),
            service: 'dashboard-admin-agent',
            jwt_secret_configured: !!process.env.JWT_SECRET,
            agent_api_key_configured: !!process.env.AGENT_API_KEY,
            node_env: process.env.NODE_ENV || 'development',
            admin_port: parseInt(process.env.ADMIN_PORT || '3001', 10),
            db_connected: dbConnected,
            admin_users_count: adminUsersCount,
        });
    }
    catch {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// ─── GET /db-status — 数据库表状态诊断 ─────────────────────────
router.get('/db-status', agentAuth, async (_req, res) => {
    try {
        const connected = await checkDbConnection();
        const tableNames = ['admin_users', 'projects', 'audit_logs', '_prisma_migrations'];
        const tables = {};
        for (const name of tableNames) {
            tables[name] = { exists: false, row_count: 0 };
        }
        if (connected) {
            for (const name of tableNames) {
                try {
                    const result = await prisma_1.default.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM \`${name}\``);
                    const row = result[0];
                    if (row) {
                        tables[name] = { exists: true, row_count: Number(row.cnt) };
                    }
                    else {
                        tables[name] = { exists: false, row_count: 0 };
                    }
                }
                catch {
                    // Table does not exist — keep defaults
                }
            }
        }
        res.json({ connected, tables });
    }
    catch {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// ─── GET /admin-users — 查看管理员用户列表 ─────────────────────
router.get('/admin-users', agentAuth, async (_req, res) => {
    try {
        const users = await prisma_1.default.adminUser.findMany({
            select: { id: true, username: true, role: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ users, count: users.length });
    }
    catch {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
// ─── POST /seed-admin — 初始化超级管理员 ─────────────────────────
// 幂等操作：若 ADMIN_SEED_USERNAME 指定的用户已存在则直接返回成功
router.post('/seed-admin', agentAuth, async (_req, res) => {
    try {
        const seedUsername = process.env.ADMIN_SEED_USERNAME || 'admin';
        const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin123!';
        const existing = await prisma_1.default.adminUser.findUnique({ where: { username: seedUsername } });
        if (existing) {
            res.json({
                success: true,
                message: `Admin user '${seedUsername}' already exists`,
                alreadyExisted: true,
            });
            return;
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
        const passwordHash = await bcrypt.hash(seedPassword, 12);
        const admin = await prisma_1.default.adminUser.create({
            data: { username: seedUsername, passwordHash, role: 'super_admin' },
            select: { id: true, username: true, role: true, status: true, createdAt: true },
        });
        res.status(201).json({
            success: true,
            message: `Admin user '${seedUsername}' created`,
            data: admin,
        });
    }
    catch {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
console.log('[Agent] Agent debug routes registered');
exports.default = router;
