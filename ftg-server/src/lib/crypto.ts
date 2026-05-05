/**
 * AES-256-GCM 加密/解密工具
 *
 * - 密钥通过环境变量 ENCRYPTION_KEY 获取（需为 32 字节 hex 或 base64 编码）
 * - 每次加密使用随机 12 字节 IV
 * - 输出格式: base64(iv + authTag + ciphertext)
 * - 解密时从 base64 中提取 IV、authTag 和密文
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * 获取加密密钥（32 字节 Buffer）
 */
function getKey(): Buffer {
  const encoded = process.env.ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error('ENCRYPTION_KEY 环境变量未设置');
  }

  // 尝试 hex 解码，失败则尝试 base64 解码
  if (/^[0-9a-fA-F]{64}$/.test(encoded)) {
    return Buffer.from(encoded, 'hex');
  }

  try {
    const decoded = Buffer.from(encoded, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // ignore, fall through
  }

  // 最后尝试直接使用 SHA-256 派生 32 字节密钥
  return crypto.createHash('sha256').update(encoded).digest();
}

/**
 * 使用 AES-256-GCM 加密明文
 *
 * @param plaintext - 待加密的明文
 * @returns base64 编码的密文（包含 IV + authTag + ciphertext）
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 拼接: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * 使用 AES-256-GCM 解密密文
 *
 * @param ciphertext - base64 编码的密文（encrypt 函数的输出）
 * @returns 解密后的明文字符串
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const combined = Buffer.from(ciphertext, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('密文数据长度无效');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
