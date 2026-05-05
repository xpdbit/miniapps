/**
 * 共享 PrismaClient 单例
 * 所有 Admin API 路由模块共用同一数据库连接池，避免多实例造成连接浪费
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default prisma
