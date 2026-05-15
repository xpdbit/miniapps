/**
 * API Key 管理服务
 *
 * 提供 API Key 的加密存储、查询和删除功能。
 * - 存储前使用 AES-256-GCM 加密
 * - getKey 只返回是否存在（不泄露明文）
 * - getDecryptedKey 供内部服务使用（返回明文）
 */

import prisma from '../lib/prisma';
import { encrypt, decrypt } from '../lib/crypto';

/**
 * 加密并存储 API Key（不存在则创建，存在则更新）
 */
export async function setApiKey(
  userId: number,
  serviceName: string,
  apiKey: string
): Promise<void> {
  const encryptedKey = encrypt(apiKey);

  await prisma.apiKey.upsert({
    where: {
      userId_serviceName: { userId, serviceName },
    },
    update: {
      encryptedKey,
      isActive: true,
    },
    create: {
      userId,
      serviceName,
      encryptedKey,
    },
  });
}

interface ApiKeyExistsResult {
  hasKey: boolean;
}

/**
 * 检查用户是否配置了指定服务的 API Key
 * 只返回是否存在，不泄露密钥内容
 */
export async function getApiKey(
  userId: number,
  serviceName: string
): Promise<ApiKeyExistsResult> {
  const record = await prisma.apiKey.findUnique({
    where: {
      userId_serviceName: { userId, serviceName },
    },
    select: { id: true, isActive: true },
  });

  return { hasKey: record !== null && record.isActive };
}

/**
 * 获取解密后的 API Key 明文（供内部服务使用）
 * 注意：调用方需确保不将返回值写入日志或泄漏给客户端
 */
export async function getDecryptedApiKey(
  userId: number,
  serviceName: string
): Promise<string | null> {
  const record = await prisma.apiKey.findUnique({
    where: {
      userId_serviceName: { userId, serviceName },
    },
  });

  if (!record || !record.isActive) {
    return null;
  }

  // 更新最后使用时间（不阻塞）
  prisma.apiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // 静默处理，不影响主流程
    });

  try {
    return decrypt(record.encryptedKey);
  } catch {
    return null;
  }
}

/**
 * 删除用户的 API Key
 */
export async function deleteApiKey(
  userId: number,
  serviceName: string
): Promise<boolean> {
  try {
    await prisma.apiKey.delete({
      where: {
        userId_serviceName: { userId, serviceName },
      },
    });
    return true;
  } catch {
    return false;
  }
}
