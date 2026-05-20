"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.PERMISSIONS = void 0;
exports.authenticate = authenticate;
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("./prisma"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || (() => { console.error('[SECURITY] JWT_SECRET 未设置！请在生产环境中通过环境变量提供 JWT_SECRET。'); return 'dashboard-dev-secret'; })();
const TOKEN_EXPIRY = '24h';
// NOTE: 审计日志保留 90 天，建议设置定时任务定期清理：
// DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 90 DAY
// ─── Audit Log Helpers ─────────────────────────────────────────────
/** 获取客户端真实 IP 地址 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string')
        return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded))
        return forwarded[0].trim();
    return req.ip || req.socket.remoteAddress || 'unknown';
}
/** 记录审计日志（静默失败，不中断请求） */
async function auditLog(params) {
    try {
        await prisma_1.default.dashboardAuditLog.create({
            data: {
                admin_id: params.adminId,
                action: params.action,
                target_type: params.targetType ?? null,
                target_id: params.targetId ?? null,
                details: params.details,
                ip_address: getClientIp(params.req),
            },
        });
    }
    catch (error) {
        console.error('[AuditLog] 记录失败:', error);
    }
}
// ─── RBAC Permission System ─────────────────────────────────────────
/** All available permission names */
exports.PERMISSIONS = {
    DASHBOARD: 'dashboard',
    USERS: 'users',
    RECORDS: 'records',
    THEMES: 'themes',
    ACHIEVEMENTS: 'achievements',
    API_KEYS: 'api_keys',
    PROJECTS: 'projects',
    MONITORING: 'monitoring',
    ADMIN_USERS: 'admin_users',
    AUDIT_LOGS: 'audit_logs',
};
/** Role → Permission mapping — '*' means all permissions */
exports.ROLE_PERMISSIONS = {
    super_admin: ['*'],
    admin: ['dashboard', 'users', 'records', 'themes', 'achievements', 'api_keys', 'monitoring', 'projects'],
    viewer: ['dashboard', 'monitoring'],
};
// ─── Middleware ──────────────────────────────────────────────────────
/** Extract & verify JWT, attach admin info to request */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: '未登录' });
        return;
    }
    try {
        const token = authHeader.slice(7);
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    }
    catch {
        res.status(401).json({ success: false, message: '令牌无效或已过期' });
    }
}
/** Require a specific permission (must be used after `authenticate`) */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.admin) {
            res.status(401).json({ success: false, message: '未登录' });
            return;
        }
        const permissions = exports.ROLE_PERMISSIONS[req.admin.role];
        if (!permissions || (!permissions.includes('*') && !permissions.includes(permission))) {
            res.status(403).json({ success: false, message: '无权限' });
            return;
        }
        next();
    };
}
// ─── Public Routes ──────────────────────────────────────────────────
// POST /api/admin/register — initial super admin registration
// 安全限制：仅当 admin_users 表为空时允许注册（仅首次部署可用）
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, message: '用户名和密码不能为空' });
            return;
        }
        // 安全守卫：禁止在已有管理员时注册新管理员
        const totalAdmins = await prisma_1.default.dashboardAdminUser.count();
        if (totalAdmins > 0) {
            res.status(403).json({ success: false, message: '管理员注册已关闭。如需添加新管理员，请由现有管理员在后台创建。' });
            return;
        }
        const existing = await prisma_1.default.dashboardAdminUser.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ success: false, message: '用户名已存在' });
            return;
        }
        const password_hash_val = await bcrypt_1.default.hash(password, 12);
        const admin = await prisma_1.default.dashboardAdminUser.create({
            data: { username, password_hash: password_hash_val, role: 'super_admin' },
        });
        res.json({ success: true, data: { id: admin.id, username: admin.username, role: admin.role } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, message: '用户名和密码不能为空' });
            return;
        }
        const admin = await prisma_1.default.dashboardAdminUser.findUnique({ where: { username } });
        if (!admin) {
            console.error('[Login] 用户不存在: "' + username + '"');
            res.status(401).json({ success: false, message: '用户名或密码错误' });
            return;
        }
        if (admin.status === 'disabled') {
            console.error('[Login] 账号已禁用: "' + username + '" (id=' + admin.id + ')');
            res.status(401).json({ success: false, message: '用户名或密码错误' });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, admin.password_hash);
        if (!valid) {
            console.error('[Login] 密码错误: "' + username + '" (id=' + admin.id + ')');
            res.status(401).json({ success: false, message: '用户名或密码错误' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ adminId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        // 记录登录日志
        await auditLog({
            req,
            adminId: admin.id,
            action: 'LOGIN',
            details: { username: admin.username },
        });
        console.log('[Login] 登录成功: "' + username + '" (id=' + admin.id + ', role=' + admin.role + ')');
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: admin.id,
                    username: admin.username,
                    role: admin.role,
                },
            },
        });
    }
    catch (error) {
        console.error('[Login] 服务器错误:', error);
        res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
    }
});
// ─── Authenticated Routes (any valid role) ──────────────────────────
// GET /api/admin/me — get current admin info
router.get('/me', authenticate, async (req, res) => {
    try {
        const admin = await prisma_1.default.dashboardAdminUser.findUnique({
            where: { id: req.admin.adminId },
            select: { id: true, username: true, role: true, status: true, created_at: true },
        });
        if (!admin) {
            res.status(404).json({ success: false, message: '管理员不存在' });
            return;
        }
        res.json({ success: true, data: { user: admin } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/change-password
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const admin = await prisma_1.default.dashboardAdminUser.findUnique({ where: { id: req.admin.adminId } });
        if (!admin) {
            res.status(404).json({ success: false, message: '管理员不存在' });
            return;
        }
        const valid = await bcrypt_1.default.compare(oldPassword, admin.passwordHash);
        if (!valid) {
            res.status(400).json({ success: false, message: '旧密码不正确' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 12);
        await prisma_1.default.dashboardAdminUser.update({
            where: { id: req.admin.adminId },
            data: { passwordHash },
        });
        // 记录修改密码日志
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'CHANGE_PASSWORD',
        });
        res.json({ success: true, message: '密码修改成功' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ─── Admin Management Routes (super_admin only, requires 'admin_users') ──
// GET /api/admin/users — list all admin accounts
router.get('/users', authenticate, requirePermission('admin_users'), async (req, res) => {
    try {
        const users = await prisma_1.default.dashboardAdminUser.findMany({
            select: { id: true, username: true, role: true, status: true, created_at: true, updated_at: true },
            orderBy: { created_at: 'desc' },
        });
        res.json({ success: true, data: { users } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/users — create a new admin account (super_admin only)
router.post('/users', authenticate, requirePermission('admin_users'), async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, message: '用户名和密码不能为空' });
            return;
        }
        const existing = await prisma_1.default.dashboardAdminUser.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ success: false, message: '用户名已存在' });
            return;
        }
        const password_hash_val = await bcrypt_1.default.hash(password, 12);
        const validRole = (role && ['super_admin', 'admin', 'viewer'].includes(role)) ? role : 'admin';
        const admin = await prisma_1.default.dashboardAdminUser.create({
            data: { username, password_hash: password_hash_val, role: validRole },
            select: { id: true, username: true, role: true, status: true, created_at: true, updated_at: true },
        });
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'CREATE_ADMIN',
            targetType: 'admin_user',
            targetId: admin.id,
            details: { username, role: validRole },
        });
        res.status(201).json({ success: true, data: { user: admin } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// DELETE /api/admin/users/:id — delete an admin account (super_admin only)
router.delete('/users/:id', authenticate, requirePermission('admin_users'), async (req, res) => {
    try {
        const targetId = req.params.id;
        // MUST NOT delete self
        if (targetId === req.admin.adminId) {
            res.status(403).json({ success: false, message: '不能删除自己的账号' });
            return;
        }
        const target = await prisma_1.default.dashboardAdminUser.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: '管理员不存在' });
            return;
        }
        await prisma_1.default.dashboardAdminUser.delete({ where: { id: targetId } });
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'DELETE_ADMIN',
            targetType: 'admin_user',
            targetId: targetId,
            details: { username: target.username, role: target.role },
        });
        res.json({ success: true, message: '删除成功' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// PUT /api/admin/users/:id/role — change another admin's role (super_admin only)
router.put('/users/:id/role', authenticate, requirePermission('admin_users'), async (req, res) => {
    try {
        const targetId = req.params.id;
        const { role } = req.body;
        if (!role || !['super_admin', 'admin', 'viewer'].includes(role)) {
            res.status(400).json({ success: false, message: '无效的角色' });
            return;
        }
        // MUST NOT: allow admin to downgrade self
        if (targetId === req.admin.adminId) {
            res.status(403).json({ success: false, message: '不能修改自己的角色' });
            return;
        }
        const target = await prisma_1.default.dashboardAdminUser.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: '管理员不存在' });
            return;
        }
        const updated = await prisma_1.default.dashboardAdminUser.update({
            where: { id: targetId },
            data: { role },
            select: { id: true, username: true, role: true, status: true, created_at: true, updated_at: true },
        });
        // 记录角色变更日志
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'CHANGE_ROLE',
            targetType: 'admin_user',
            targetId: targetId,
            details: { fromRole: target.role, toRole: role, targetUsername: target.username },
        });
        res.json({ success: true, data: { user: updated } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ─── Project Management Routes (super_admin only, requires 'projects') ──
// GET /api/admin/projects — list all projects
router.get('/projects', authenticate, requirePermission('projects'), async (req, res) => {
    try {
        const projects = await prisma_1.default.dashboardProject.findMany({ orderBy: { created_at: 'desc' } });
        res.json({ success: true, data: { projects } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/projects — create project
router.post('/projects', authenticate, requirePermission('projects'), async (req, res) => {
    try {
        const { name, apiBaseUrl, description } = req.body;
        const project = await prisma_1.default.dashboardProject.create({
            data: { name, api_base_url: apiBaseUrl, description: description || null },
        });
        // 记录创建项目日志
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'CREATE_PROJECT',
            targetType: 'project',
            targetId: project.id,
            details: { name, apiBaseUrl },
        });
        res.status(201).json({ success: true, data: { project } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// PUT /api/admin/projects/:id — update project
router.put('/projects/:id', authenticate, requirePermission('projects'), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, apiBaseUrl, description, status } = req.body;
        // 获取更新前的项目数据用于记录变更
        const oldProject = await prisma_1.default.dashboardProject.findUnique({ where: { id } });
        const project = await prisma_1.default.dashboardProject.update({
            where: { id },
            data: { name, api_base_url: apiBaseUrl, description, status },
        });
        // 记录更新项目日志
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'UPDATE_PROJECT',
            targetType: 'project',
            targetId: id,
            details: {
                changes: {
                    name: { from: oldProject?.name, to: name },
                    apiBaseUrl: { from: oldProject?.api_base_url, to: apiBaseUrl },
                    description: { from: oldProject?.description, to: description },
                    status: { from: oldProject?.status, to: status },
                },
            },
        });
        res.json({ success: true, data: { project } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// DELETE /api/admin/projects/:id
router.delete('/projects/:id', authenticate, requirePermission('projects'), async (req, res) => {
    try {
        const id = req.params.id;
        // 获取删除前的项目数据用于记录
        const deletedProject = await prisma_1.default.dashboardProject.findUnique({ where: { id } });
        await prisma_1.default.dashboardProject.delete({ where: { id } });
        // 记录删除项目日志
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'DELETE_PROJECT',
            targetType: 'project',
            targetId: id,
            details: deletedProject
                ? { name: deletedProject.name, apiBaseUrl: deletedProject.api_base_url }
                : undefined,
        });
        res.json({ success: true, message: '删除成功' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/projects/:id/test — test health connection
router.post('/projects/:id/test', authenticate, requirePermission('projects'), async (req, res) => {
    try {
        const id = req.params.id;
        const project = await prisma_1.default.dashboardProject.findUnique({ where: { id } });
        if (!project) {
            res.status(404).json({ success: false, message: '项目不存在' });
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const axios = require('axios');
            const response = await axios.get(`${project.api_base_url}/health`, { timeout: 5000 });
            await prisma_1.default.dashboardProject.update({ where: { id }, data: { status: 'active' } });
            res.json({ success: true, message: '连接成功', data: { status: response.status, data: response.data } });
        }
        catch (err) {
            await prisma_1.default.dashboardProject.update({ where: { id }, data: { status: 'inactive' } });
            res.json({ success: false, message: '连接失败: ' + err.message, data: { status: 'inactive' } });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ─── Role Management Routes (super_admin only) ───
const PREDEFINED_ROLES = {
    super_admin: {
        name: 'super_admin',
        label: '超级管理员',
        permissions: ['dashboard', 'users', 'records', 'themes', 'achievements', 'api_keys', 'projects', 'monitoring', 'admin_users', 'audit_logs'],
    },
    admin: {
        name: 'admin',
        label: '管理员',
        permissions: ['dashboard', 'users', 'records', 'themes', 'achievements', 'api_keys', 'monitoring'],
    },
    viewer: {
        name: 'viewer',
        label: '观察者',
        permissions: ['dashboard', 'monitoring'],
    },
};
// GET /api/admin/roles — list all roles with permissions
router.get('/roles', authenticate, async (_req, res) => {
    try {
        const roles = Object.values(PREDEFINED_ROLES);
        res.json({ success: true, data: { roles } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// POST /api/admin/roles — add a new role (records role configuration)
router.post('/roles', authenticate, requirePermission('admin_users'), async (req, res) => {
    try {
        // Note: Roles are predefined in the schema enum and cannot be dynamically created.
        // This endpoint exists for API completeness and records the attempt.
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'CREATE_ROLE',
            details: { attemptedRole: req.body },
        });
        res.status(501).json({ success: false, message: '角色由系统预定义，暂不支持动态创建' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// PUT /api/admin/roles/:id/permissions — update role permissions
router.put('/roles/:id/permissions', authenticate, requirePermission('admin_users'), async (req, res) => {
    try {
        // Note: Roles are predefined and permissions are fixed.
        // This endpoint exists for API completeness and records the attempt.
        await auditLog({
            req,
            adminId: req.admin.adminId,
            action: 'UPDATE_ROLE_PERMISSIONS',
            details: { roleId: req.params.id, attemptedPermissions: req.body },
        });
        res.status(501).json({ success: false, message: '角色权限由系统预定义，暂不支持动态修改' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ─── Audit Log Routes ──────────────────────────────────────────────
// GET /api/admin/audit-logs — list audit logs with filters
router.get('/audit-logs', authenticate, async (req, res) => {
    try {
        const { adminId, action, startDate, endDate, page = '1', pageSize = '20', } = req.query;
        const where = {};
        if (adminId) {
            where.admin_id = adminId;
        }
        if (action) {
            where.action = action;
        }
        if (startDate || endDate) {
            const created_at_filter = {};
            if (startDate)
                created_at_filter.gte = new Date(startDate);
            if (endDate)
                created_at_filter.lte = new Date(endDate + 'T23:59:59.999Z');
            where.created_at = created_at_filter;
        }
        const currentPage = Math.max(1, parseInt(page || '1'));
        const currentPageSize = Math.min(100, Math.max(1, parseInt(pageSize || '20')));
        const skip = (currentPage - 1) * currentPageSize;
        const [list, total] = await Promise.all([
            prisma_1.default.dashboardAuditLog.findMany({
                where: where,
                include: {
                    admin: { select: { id: true, username: true } },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: currentPageSize,
            }),
            prisma_1.default.dashboardAuditLog.count({ where: where }),
        ]);
        res.json({ success: true, data: { list, total } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// GET /api/admin/audit-logs/actions — list distinct action types
router.get('/audit-logs/actions', authenticate, async (_req, res) => {
    try {
        // Query distinct action values using raw query since Prisma doesn't support `distinct` on specific fields easily
        const result = await prisma_1.default.dashboardAuditLog.findMany({
            select: { action: true },
            distinct: ['action'],
            orderBy: { action: 'asc' },
        });
        const actions = result.map((r) => r.action);
        res.json({ success: true, data: { actions } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
