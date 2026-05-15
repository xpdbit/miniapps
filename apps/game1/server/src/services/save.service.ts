import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';
import { prisma } from './db';

/**
 * 计算 JSON 数据的 MD5 checksum
 */
export function computeChecksum(data: unknown): string {
  const raw = JSON.stringify(data);
  return createHash('md5').update(raw).digest('hex');
}

/**
 * 上传存档（upsert），支持版本冲突检测
 * @param playerId 玩家 ID
 * @param saveData 存档数据
 * @param expectedVersion 期望的当前版本号（可选），不匹配则抛出 ConflictError
 */
export async function uploadSave(
  playerId: number,
  saveData: Record<string, unknown>,
  expectedVersion?: number,
) {
  const checksum = computeChecksum(saveData);

  // 版本冲突检测
  if (expectedVersion !== undefined) {
    const existing = await prisma.game1CloudSave.findUnique({
      where: { playerId },
      select: { version: true },
    });
    if (existing && existing.version !== expectedVersion) {
      throw new ConflictError('存档版本冲突，请刷新后重试');
    }
  }

  return prisma.game1CloudSave.upsert({
    where: { playerId },
    create: {
      playerId,
      saveData: saveData as Prisma.InputJsonValue,
      checksum,
      version: 1,
    },
    update: {
      saveData: saveData as Prisma.InputJsonValue,
      checksum,
      version: { increment: 1 },
    },
  });
}

/**
 * 下载存档数据
 */
export async function downloadSave(playerId: number) {
  const save = await prisma.game1CloudSave.findUnique({
    where: { playerId },
  });
  if (!save) throw new NotFoundError('存档不存在');
  return save;
}

/**
 * 获取存档元信息（版本号、checksum、更新时间）
 */
export async function getSaveMeta(playerId: number) {
  const save = await prisma.game1CloudSave.findUnique({
    where: { playerId },
    select: {
      version: true,
      checksum: true,
      updatedAt: true,
    },
  });
  if (!save) throw new NotFoundError('存档不存在');
  return save;
}

/**
 * 删除存档记录
 */
export async function deleteSave(playerId: number): Promise<void> {
  try {
    await prisma.game1CloudSave.delete({
      where: { playerId },
    });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    // P2025 = 记录不存在，忽略
    if (prismaErr.code === 'P2025') return;
    throw err;
  }
}
