import prisma from '../utils/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import axios from 'axios';

export async function listKeys(userId: string) {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, provider: true, isActive: true, createdAt: true, updatedAt: true },
  });
  return keys;
}

export async function addKey(userId: string, provider: string, keyValue: string) {
  const { encrypted, iv, tag } = encrypt(keyValue);
  const key = await prisma.apiKey.create({
    data: { userId, provider, keyValue: JSON.stringify({ encrypted, iv, tag }) },
  });
  return { id: key.id, provider: key.provider, isActive: key.isActive, createdAt: key.createdAt };
}

export async function deleteKey(id: string, userId: string) {
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== userId) throw new Error('FORBIDDEN');
  await prisma.apiKey.delete({ where: { id } });
}

export async function verifyKey(provider: string, keyValue: string): Promise<boolean> {
  try {
    const baseUrls: Record<string, string> = {
      openai: 'https://api.openai.com',
      deepseek: 'https://api.deepseek.com',
      openrouter: 'https://openrouter.ai/api',
    };
    const baseUrl = baseUrls[provider];
    if (!baseUrl) return false;
    await axios.get(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${keyValue}` },
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function getDecryptedKey(userId: string, provider: string) {
  const key = await prisma.apiKey.findFirst({ where: { userId, provider, isActive: true } });
  if (!key) return null;
  const stored = JSON.parse(key.keyValue);
  return decrypt(stored.encrypted, stored.iv, stored.tag);
}