"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Dashboard Stats API Routes
// 查询 miniapps 数据库提供仪表盘统计数据
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const router = (0, express_1.Router)();
/** 聚合统计概览 */
router.get('/stats', async (_req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [totalUsers, totalFoodRecords, totalCheckIns, newUsersToday, recognitionsToday, checkInsToday, newUsersThisMonth] = await prisma_1.default.$transaction([
            prisma_1.default.sharedUser.count(),
            prisma_1.default.ftgFoodRecord.count(),
            prisma_1.default.ftgCheckin.count(),
            prisma_1.default.sharedUser.count({ where: { created_at: { gte: todayStart } } }),
            prisma_1.default.ftgFoodRecord.count({ where: { created_at: { gte: todayStart } } }),
            prisma_1.default.ftgCheckin.count({ where: { created_at: { gte: todayStart } } }),
            prisma_1.default.sharedUser.count({ where: { created_at: { gte: monthStart } } }),
        ]);
        res.json({ success: true, data: { totalUsers, newUsersToday, newUsersThisMonth, totalFoodRecords, recognitionsToday, totalCheckIns, checkInsToday } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
/** 近30天新用户趋势 */
router.get('/stats/user-trend', async (_req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const users = await prisma_1.default.sharedUser.findMany({
            where: { created_at: { gte: thirtyDaysAgo } },
            select: { created_at: true },
            orderBy: { created_at: 'asc' },
        });
        const grouped = {};
        for (const u of users) {
            const date = u.created_at.toISOString().slice(0, 10);
            grouped[date] = (grouped[date] || 0) + 1;
        }
        const data = Object.entries(grouped).map(([date, value]) => ({ date, value }));
        res.json({ success: true, data });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
/** 近30天识别量趋势 */
router.get('/stats/recognition-trend', async (_req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const records = await prisma_1.default.ftgFoodRecord.findMany({
            where: { created_at: { gte: thirtyDaysAgo } },
            select: { created_at: true },
            orderBy: { created_at: 'asc' },
        });
        const grouped = {};
        for (const r of records) {
            const date = r.created_at.toISOString().slice(0, 10);
            grouped[date] = (grouped[date] || 0) + 1;
        }
        const data = Object.entries(grouped).map(([date, value]) => ({ date, value }));
        res.json({ success: true, data });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
/** 食物类型分布 */
router.get('/stats/food-type-distribution', async (_req, res) => {
    try {
        const result = await prisma_1.default.ftgFoodRecord.groupBy({
            by: ['food_type'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        });
        const data = result.map((r) => ({ type: r.food_type, value: r._count.id }));
        res.json({ success: true, data });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
/** 主题使用分布 */
router.get('/stats/theme-usage-distribution', async (_req, res) => {
    try {
        const themes = await prisma_1.default.ftgTheme.findMany({
            take: 10,
            orderBy: { usage_count: 'desc' },
            select: { name: true, theme_id: true },
        });
        const data = await Promise.all(themes.map((t) => prisma_1.default.ftgFoodRecord
            .count({ where: { theme_id: t.theme_id, is_deleted: false } })
            .then((count) => ({ type: t.name, value: count }))));
        res.json({ success: true, data });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
exports.default = router;
