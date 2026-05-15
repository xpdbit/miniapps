/**
 * 共享 PrismaClient 单例
 * 所有服务文件通过此模块获取 client，避免连接池膨胀
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
