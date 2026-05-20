"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 共享 PrismaClient 单例
 * 所有 Admin API 路由模块共用同一数据库连接池，避免多实例造成连接浪费
 */
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.default = prisma;
