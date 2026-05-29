import prisma from '../utils/prisma'
import { encrypt, decrypt, encryptApiKey, decryptKeyAuto } from '../utils/crypto'
import axios from 'axios'

export async function listKeys(userId: string) {
  const keys = await prisma.tavernApiKey.findMany({
    where: { userUuid: userId },
    select: { id: true, provider: true, baseUrl: true, isActive: true, createdAt: true, updatedAt: true },
  })
  return keys
}

export async function addKey(userId: string, provider: string, keyValue: string, baseUrl?: string) {
  // Check for existing key (unique per user+provider)
  const existing = await prisma.tavernApiKey.findFirst({
    where: { userUuid: userId, provider },
  })
  if (existing) {
    throw new Error(`DUPLICATE:${provider}`)
  }

  // 🆕 使用盐加密（PBKDF2 + 独立 salt + AES-256-GCM）
  const { encrypted, salt, iv } = encryptApiKey(keyValue)

  const key = await prisma.tavernApiKey.create({
    data: {
      userUuid: userId,
      provider,
      keyValue: JSON.stringify({ encrypted, salt, iv }),
      salt,
      iv,
      baseUrl: baseUrl || null,
    },
  })
  return { id: key.id, provider: key.provider, baseUrl: key.baseUrl, isActive: key.isActive, createdAt: key.createdAt }
}

export async function deleteKey(id: string, userId: string) {
  const key = await prisma.tavernApiKey.findUnique({ where: { id } })
  if (!key || key.userUuid !== userId) throw new Error('FORBIDDEN')
  await prisma.tavernApiKey.delete({ where: { id } })
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
    }
    const effectiveBaseUrl = baseUrl || baseUrls[provider]
    if (!effectiveBaseUrl) return false

    switch (provider) {
      case 'anthropic':
        await axios.get(`${effectiveBaseUrl}/v1/models`, {
          headers: { 'x-api-key': keyValue, 'anthropic-version': '2023-06-01' },
          timeout: 10000,
        })
        break
      case 'google': {
        await axios.get(`${effectiveBaseUrl}/v1beta/models`, {
          headers: { 'x-goog-api-key': keyValue },
          timeout: 10000,
        })
        break
      }
      default:
        await axios.get(`${effectiveBaseUrl}/v1/models`, {
          headers: { Authorization: `Bearer ${keyValue}` },
          timeout: 10000,
        })
    }
    return true
  } catch {
    return false
  }
}

export async function getDecryptedKey(userId: string, provider: string): Promise<{ key: string; baseUrl?: string } | null> {
  const key = await prisma.tavernApiKey.findFirst({ where: { userUuid: userId, provider, isActive: true } })
  if (!key) return null

  // 兼容新旧格式：自动识别 {encrypted, iv, tag} 或 {encrypted, salt, iv}
  let decrypted: string
  try {
    decrypted = decryptKeyAuto(JSON.parse(key.keyValue))
  } catch {
    // 解密失败，可能是旧格式损坏
    return null
  }

  // 更新最后使用时间（异步，不阻塞返回）
  prisma.tavernApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return { key: decrypted, baseUrl: key.baseUrl || undefined }
}
