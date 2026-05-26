import prisma from '../utils/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import axios from 'axios';

export async function listKeys(userId: string) {
  const keys = await prisma.tavernApiKey.findMany({
    where: { userUuid: userId },
    select: { id: true, provider: true, baseUrl: true, isActive: true, createdAt: true, updatedAt: true },
  });
  return keys;
}

export async function addKey(userId: string, provider: string, keyValue: string, baseUrl?: string) {
  // Check for existing key (unique per user+provider)
  const existing = await prisma.tavernApiKey.findFirst({
    where: { userUuid: userId, provider },
  });
  if (existing) {
    throw new Error(`DUPLICATE:${provider}`);
  }
  const { encrypted, iv, tag } = encrypt(keyValue);
  const key = await prisma.tavernApiKey.create({
    data: { userUuid: userId, provider, keyValue: JSON.stringify({ encrypted, iv, tag }), baseUrl: baseUrl || null },
  });
  return { id: key.id, provider: key.provider, baseUrl: key.baseUrl, isActive: key.isActive, createdAt: key.createdAt };
}

export async function deleteKey(id: string, userId: string) {
  const key = await prisma.tavernApiKey.findUnique({ where: { id } });
  if (!key || key.userUuid !== userId) throw new Error('FORBIDDEN');
  await prisma.tavernApiKey.delete({ where: { id } });
}

export async function verifyKey(provider: string, keyValue: string, baseUrl?: string): Promise<boolean> {
  try {
    const baseUrls: Record<string, string> = {
      opencode: 'https://opencode.ai/zen/go',
      openai: 'https://api.openai.com',
      anthropic: 'https://api.anthropic.com',
      google: 'https://generativelanguage.googleapis.com',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      deepseek: 'https://api.deepseek.com',
      moonshot: 'https://api.moonshot.cn',
      minimax: 'https://api.minimaxi.com',
      openrouter: 'https://openrouter.ai/api',
    };
    const effectiveBaseUrl = baseUrl || baseUrls[provider];
    if (!effectiveBaseUrl) return false;

    // 验证方式因 provider 而异
    switch (provider) {
      case 'anthropic':
        // Anthropic 使用 /v1/models 端点验证
        await axios.get(`${effectiveBaseUrl}/v1/models`, {
          headers: { 'x-api-key': keyValue, 'anthropic-version': '2023-06-01' },
          timeout: 10000,
        });
        break;
      case 'google': {
        // Google 需要列出模型来验证
        await axios.get(`${effectiveBaseUrl}/v1beta/models`, {
          headers: { 'x-goog-api-key': keyValue },
          timeout: 10000,
        });
        break;
      }
      default:
        // OpenAI 兼容的 /v1/models 验证（包括 oneapi）
        await axios.get(`${effectiveBaseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${keyValue}` },
          timeout: 10000,
        });
    }
    return true;
  } catch {
    return false;
  }
}

export async function getDecryptedKey(userId: string, provider: string): Promise<{ key: string; baseUrl?: string } | null> {
  const key = await prisma.tavernApiKey.findFirst({ where: { userUuid: userId, provider, isActive: true } });
  if (!key) return null;
  const stored = JSON.parse(key.keyValue);
  const decrypted = decrypt(stored.encrypted, stored.iv, stored.tag);

  // 更新最后使用时间（异步，不阻塞返回）
  prisma.tavernApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return { key: decrypted, baseUrl: key.baseUrl || undefined };
}