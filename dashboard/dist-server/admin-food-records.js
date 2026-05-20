"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 食物记录管理路由 — /api/admin/food-records/*
// 查询 miniapps 数据库，提供后台管理 CRUD
const express_1 = require("express");
const prisma_1 = __importDefault(require("./prisma"));
const router = (0, express_1.Router)();
// GET /api/admin/food-records — 分页列表
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20')));
        const offset = (page - 1) * pageSize;
        const where = {};
        if (req.query.foodName) {
            // foodName is inside `data` JSON column — full-text search deferred
        }
        if (req.query.foodType) {
            where.food_type = req.query.foodType;
        }
        if (req.query.themeId) {
            where.theme_id = req.query.themeId;
        }
        const createdAtFilter = {};
        if (req.query.startDate) {
            createdAtFilter.gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
            createdAtFilter.lte = new Date(`${req.query.endDate}T23:59:59`);
        }
        if (Object.keys(createdAtFilter).length > 0) {
            where.created_at = createdAtFilter;
        }
        // 默认不显示已删除记录
        if (req.query.showDeleted !== 'true') {
            where.is_deleted = false;
        }
        const [records, total] = await Promise.all([
            prisma_1.default.ftgFoodRecord.findMany({
                where,
                include: { user: { select: { uuid: true, nickname: true } } },
                orderBy: { created_at: 'desc' },
                skip: offset,
                take: pageSize,
            }),
            prisma_1.default.ftgFoodRecord.count({ where }),
        ]);
        const mapped = records.map((r) => ({
            id: r.id,
            foodName: r.data?.foodName || null,
            foodType: r.food_type,
            thumbnailUrl: r.data?.imageUrl || null,
            themeId: r.theme_id,
            themeName: null,
            userOpenId: r.user.uuid,
            calories: r.data?.caloriesTotal || null,
            createdAt: r.created_at,
            deletedAt: r.deleted_at,
        }));
        res.json({
            success: true,
            data: { records: mapped, total, page, pageSize },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// GET /api/admin/food-records/:id — 详情
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const record = await prisma_1.default.ftgFoodRecord.findUnique({
            where: { id },
            include: { user: { select: { uuid: true, nickname: true } } },
        });
        if (!record) {
            res.status(404).json({ success: false, message: '记录不存在' });
            return;
        }
        const d = record.data;
        const result = {
            id: record.id,
            foodName: d.foodName || null,
            foodType: record.food_type,
            thumbnailUrl: d.imageUrl || null,
            originalImageUrl: d.imageUrl || null,
            themeImageUrl: d.themeImageUrl || null,
            themeId: record.theme_id,
            themeName: null,
            userOpenId: record.user.uuid,
            calories: d.caloriesTotal || null,
            createdAt: record.created_at,
            deletedAt: record.deleted_at,
        };
        const aiDescription = {
            short: d.aiDescShort || '',
            gameStyle: d.aiDescGameStyle || '',
            detail: d.aiDescDetail || '',
        };
        const nutrition = {
            protein: d.protein ?? 0,
            fat: d.fat ?? 0,
            carbs: d.carbs ?? 0,
        };
        const location = {
            latitude: d.latitude ?? 0,
            longitude: d.longitude ?? 0,
            locationName: d.locationName || '',
        };
        res.json({
            success: true,
            data: { record: { ...result, aiDescription, nutrition, location } },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// DELETE /api/admin/food-records/:id — 软删除
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await prisma_1.default.ftgFoodRecord.update({
            where: { id },
            data: { is_deleted: true, deleted_at: new Date() },
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// POST /api/admin/food-records/:id/restore — 恢复软删除
router.post('/:id/restore', async (req, res) => {
    try {
        const id = req.params.id;
        await prisma_1.default.ftgFoodRecord.update({
            where: { id },
            data: { is_deleted: false, deleted_at: null },
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// POST /api/admin/food-records/batch-delete — 批量软删除
router.post('/batch-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, message: '请提供要删除的记录ID' });
            return;
        }
        await prisma_1.default.ftgFoodRecord.updateMany({
            where: { id: { in: ids } },
            data: { is_deleted: true, deleted_at: new Date() },
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
exports.default = router;
