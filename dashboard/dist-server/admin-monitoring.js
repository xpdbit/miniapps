"use strict";
// =============================================================================
// Dashboard Admin Monitoring API Routes
// 为系统监控页面提供健康检查、性能指标和告警规则数据
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
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const prisma_1 = __importDefault(require("./prisma"));
const admin_auth_1 = require("./admin-auth");
const router = (0, express_1.Router)();
// 所有监控路由需要认证
router.use(admin_auth_1.authenticate);
// ─── 辅助函数 ─────────────────────────────────────────────────────
/**
 * 探测项目的健康端点，返回状态和响应时间
 */
async function probeProjectHealth(apiBaseUrl) {
    const start = Date.now();
    try {
        // 使用 fetch 避免额外依赖
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const responseTime = Date.now() - start;
        return { ok: res.ok, responseTime };
    }
    catch {
        return { ok: false, responseTime: Date.now() - start };
    }
}
/**
 * 生成近 24 小时的模拟指标数据（图表占位）
 * 实际生产环境应从监控系统（如 Prometheus）获取
 */
function generateMockMetrics(baseValue, variance, count) {
    const now = Date.now();
    const data = [];
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now - i * 3600000).toISOString();
        const value = Math.max(0, baseValue + (Math.random() - 0.5) * variance);
        data.push({ time, value: Math.round(value * 100) / 100 });
    }
    return data;
}
function generateMockResponseTimes(baseValue, count) {
    const now = Date.now();
    const data = [];
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now - i * 3600000).toISOString();
        data.push({
            time,
            p50: Math.max(0, baseValue + (Math.random() - 0.5) * baseValue * 0.5),
            p95: Math.max(0, baseValue * 1.5 + (Math.random() - 0.5) * baseValue * 0.8),
            p99: Math.max(0, baseValue * 2.5 + (Math.random() - 0.5) * baseValue),
        });
    }
    return data;
}
function generateMockErrorRate(count) {
    const now = Date.now();
    const data = [];
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now - i * 3600000).toISOString();
        data.push({ time, rate: Math.max(0, Math.random() * 3) });
    }
    return data;
}
function generateMockOnlineUsers(baseCount, count) {
    const now = Date.now();
    const data = [];
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(now - i * 3600000).toISOString();
        data.push({
            time,
            count: Math.max(0, Math.round(baseCount + (Math.random() - 0.5) * baseCount * 0.3)),
        });
    }
    return data;
}
// ─── Routes ───────────────────────────────────────────────────────
/**
 * GET /api/admin/monitoring/health
 * 获取所有项目的健康状态
 */
router.get('/health', async (_req, res) => {
    try {
        const projects = await prisma_1.default.project.findMany({
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
        });
        const results = await Promise.all(projects.map(async (project) => {
            const healthResult = await probeProjectHealth(project.apiBaseUrl);
            const status = healthResult.ok
                ? healthResult.responseTime < 1000
                    ? 'healthy'
                    : 'degraded'
                : 'down';
            return {
                projectId: project.id,
                projectName: project.name,
                status,
                responseTime: healthResult.responseTime,
                lastCheck: new Date().toISOString(),
                services: [
                    {
                        name: `${project.name} API`,
                        status,
                        responseTime: healthResult.responseTime,
                        lastCheck: new Date().toISOString(),
                    },
                ],
            };
        }));
        // 如果数据库没有项目记录，返回默认值
        if (results.length === 0) {
            const defaultProjects = [
                { id: 0, name: 'FTG Server', url: 'http://server:3000' },
                { id: 1, name: 'Game1 Server', url: 'http://game1-server:3000' },
                { id: 2, name: 'Tavern Server', url: 'http://tavern-server:3000' },
            ];
            const defaultResults = await Promise.all(defaultProjects.map(async (p) => {
                const healthResult = await probeProjectHealth(p.url);
                const status = healthResult.ok
                    ? healthResult.responseTime < 1000
                        ? 'healthy'
                        : 'degraded'
                    : 'down';
                return {
                    projectId: p.id,
                    projectName: p.name,
                    status,
                    responseTime: healthResult.responseTime,
                    lastCheck: new Date().toISOString(),
                    services: [
                        {
                            name: p.name,
                            status,
                            responseTime: healthResult.responseTime,
                            lastCheck: new Date().toISOString(),
                        },
                    ],
                };
            }));
            res.json({ success: true, data: defaultResults });
            return;
        }
        res.json({ success: true, data: results });
    }
    catch (e) {
        console.error('[Monitoring] 获取健康状态失败:', e);
        // 返回空数据而不是错误，让前端展示空状态
        res.json({ success: true, data: [] });
    }
});
/**
 * GET /api/admin/monitoring/metrics/:projectId
 * 获取指定项目的详细指标
 */
router.get('/metrics/:projectId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId);
        // 根据 projectId 确定基础指标值
        const baseQps = projectId === 0 || projectId === 1 ? 45 : 12;
        const baseResponseTime = projectId === 2 ? 180 : 85;
        const baseOnlineUsers = projectId === 0 || projectId === 1 ? 120 : 30;
        const metrics = {
            qps: generateMockMetrics(baseQps, 30, 24),
            responseTimes: generateMockResponseTimes(baseResponseTime, 24),
            errorRate: generateMockErrorRate(24),
            onlineUsers: generateMockOnlineUsers(baseOnlineUsers, 24),
        };
        res.json({ success: true, data: metrics });
    }
    catch (e) {
        console.error('[Monitoring] 获取指标失败:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});
/**
 * GET /api/admin/monitoring/alert-rules
 * 获取告警规则
 */
router.get('/alert-rules', async (_req, res) => {
    try {
        // 当前为预定义规则，后续可从数据库读取
        const rules = [
            {
                name: '错误率过高',
                condition: '错误率 > 5%',
                severity: 'warning',
                description: '服务处于亚健康状态，建议检查日志',
            },
            {
                name: '服务离线',
                condition: '服务无响应',
                severity: 'critical',
                description: '服务完全不可用，需要立即处理',
            },
            {
                name: '响应时间过长',
                condition: '平均响应时间 > 3s',
                severity: 'warning',
                description: '响应时间超过阈值，可能影响用户体验',
            },
            {
                name: 'QPS 突增',
                condition: 'QPS 较前日同期增长 > 100%',
                severity: 'warning',
                description: '流量大幅增长，关注系统负载',
            },
            {
                name: '在线用户异常',
                condition: '在线用户数 < 正常值的 10%',
                severity: 'error',
                description: '在线用户数异常偏低，可能服务异常',
            },
        ];
        res.json({ success: true, data: rules });
    }
    catch (e) {
        console.error('[Monitoring] 获取告警规则失败:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});
/**
 * GET /api/admin/monitoring/system-metrics
 * 获取服务器系统资源指标（CPU / 内存 / 磁盘 / 运行时间）
 */
router.get('/system-metrics', async (_req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = Math.round((usedMem / totalMem) * 100);
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        let diskTotal = 0;
        let diskUsed = 0;
        let diskFree = 0;
        let diskPercent = 0;
        try {
            const df = (0, child_process_1.execSync)('df -k /', { encoding: 'utf-8', timeout: 3000 });
            const lines = df.trim().split('\n');
            if (lines.length >= 2) {
                const parts = lines[1].split(/\s+/);
                if (parts.length >= 4) {
                    diskTotal = parseInt(parts[1], 10) * 1024;
                    diskUsed = parseInt(parts[2], 10) * 1024;
                    diskFree = parseInt(parts[3], 10) * 1024;
                    diskPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
                }
            }
        }
        catch {
            // 磁盘信息获取失败，保持默认值
        }
        res.json({
            success: true,
            data: {
                cpu: {
                    model: cpus[0]?.model || 'Unknown',
                    cores: cpus.length,
                    loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
                    loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
                    loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
                    usagePercent: Math.round(Math.min(100, (loadAvg[0] / cpus.length) * 100)),
                },
                memory: {
                    total: totalMem,
                    used: usedMem,
                    free: freeMem,
                    percent: memPercent,
                },
                disk: {
                    total: diskTotal,
                    used: diskUsed,
                    free: diskFree,
                    percent: diskPercent,
                },
                uptime: os.uptime(),
                process: {
                    nodeVersion: process.version,
                    pid: process.pid,
                    memoryUsage: process.memoryUsage().rss,
                },
            },
        });
    }
    catch (e) {
        console.error('[Monitoring] 获取系统指标失败:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});
exports.default = router;
