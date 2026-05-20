"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 成就管理路由 — /api/admin/achievements/*
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const router = (0, express_1.Router)();
// GET /api/admin/achievements — 列表
router.get('/', async (_req, res) => {
    try {
        const achievements = await prisma_1.default.ftgAchievement.findMany({
            orderBy: { created_at: 'desc' },
        });
        const rows = achievements.map((r) => ({
            id: r.achievement_id,
            name: r.name,
            description: r.description,
            icon: r.icon_url,
            conditionType: r.condition_type,
            conditionValue: r.condition_value,
            themeId: r.theme_id,
            themeName: null,
            isPreset: 1,
            sortOrder: 0,
            createdAt: r.created_at,
        }));
        res.json({ success: true, data: { achievements: rows } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// GET /api/admin/achievements/stats — 统计面板
router.get('/stats', async (_req, res) => {
    try {
        const totalUsers = await prisma_1.default.sharedUser.count();
        const unlockedUsers = await prisma_1.default.ftgUserAchievement.findMany({
            where: { is_unlocked: true },
            distinct: ['user_id'],
            select: { user_id: true },
        });
        const unlockedUsersCount = unlockedUsers.length;
        const achievementRates = await prisma_1.default.ftgAchievement.findMany({
            include: {
                _count: {
                    select: {
                        userAchievements: { where: { is_unlocked: true } },
                    },
                },
            },
        });
        const rates = achievementRates.map((a) => {
            const unlockedCount = a._count.userAchievements;
            const rate = totalUsers > 0
                ? Math.round(unlockedCount * 1000 / totalUsers) / 10
                : 0;
            return {
                achievementId: a.achievement_id,
                achievementName: a.name,
                unlockedCount,
                totalCount: totalUsers,
                rate,
            };
        });
        const recentUnlocks = await prisma_1.default.ftgUserAchievement.findMany({
            where: { is_unlocked: true },
            include: {
                achievement: { select: { name: true } },
                user: { select: { uuid: true, nickname: true } },
            },
            orderBy: { unlocked_at: 'desc' },
            take: 20,
        });
        const unlocks = recentUnlocks.map((ua) => ({
            id: ua.id,
            achievementId: ua.achievement_id,
            achievementName: ua.achievement.name,
            userOpenId: ua.user.uuid,
            userName: ua.user.nickname,
            unlockedAt: ua.unlocked_at,
        }));
        const overallUnlockRate = totalUsers > 0
            ? Math.round(unlockedUsersCount * 10000 / totalUsers) / 100
            : 0;
        res.json({
            success: true,
            data: {
                totalUsers,
                unlockedUsersCount,
                overallUnlockRate,
                achievementRates: rates,
                recentUnlocks: unlocks,
            },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// PUT /api/admin/achievements/:id — 更新配置
router.put('/:id', async (req, res) => {
    try {
        const achievementId = req.params.id;
        const { icon, description, conditionValue, themeId } = req.body;
        const data = {};
        if (icon !== undefined) {
            data.icon_url = icon;
        }
        if (description !== undefined) {
            data.description = description;
        }
        if (conditionValue !== undefined) {
            data.condition_value = conditionValue;
        }
        if (themeId !== undefined) {
            data.theme_id = themeId ?? null;
        }
        if (Object.keys(data).length === 0) {
            res.status(400).json({ success: false, message: '没有提供更新字段' });
            return;
        }
        await prisma_1.default.ftgAchievement.update({
            where: { achievement_id: achievementId },
            data,
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// GET /api/admin/achievements/:id/users — 已解锁用户列表
router.get('/:id/users', async (req, res) => {
    try {
        const achievementId = req.params.id;
        const records = await prisma_1.default.ftgUserAchievement.findMany({
            where: { achievement_id: achievementId, is_unlocked: true },
            include: {
                user: { select: { uuid: true, nickname: true } },
            },
            orderBy: { unlocked_at: 'desc' },
        });
        const rows = records.map((ua) => ({
            id: ua.id,
            userOpenId: ua.user.uuid,
            userName: ua.user.nickname,
            unlockedAt: ua.unlocked_at,
        }));
        res.json({ success: true, data: { users: rows } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// POST /api/admin/achievements/trigger — 手动触发成就检测
router.post('/trigger', async (_req, res) => {
    try {
        // 占位实现 — 实际成就检测逻辑由云函数或定时任务执行
        res.json({ success: true, data: { unlocked: [] } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
exports.default = router;
