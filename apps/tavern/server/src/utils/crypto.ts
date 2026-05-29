import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32; // 256 bits
const PBKDF2_DIGEST = 'sha256';

// =============================================================================
//  通用：从 ENCRYPTION_KEY 提取 32 字节 AES 密钥（兼容旧逻辑）
// =============================================================================
function getMasterKey(): Buffer {
  return Buffer.from(
    config.encryptionKey.slice(0, 64).padEnd(64, '0'),
    'hex',
  ).slice(0, 32);
}

// =============================================================================
//  旧版加密（兼容存量的 {encrypted, iv, tag} 格式）
//  =============================================================================

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBytes = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, keyBytes, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const keyBytes = getMasterKey();
  const ivBytes = Buffer.from(iv, 'hex');
  const tagBytes = Buffer.from(tag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBytes, ivBytes);
  decipher.setAuthTag(tagBytes);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// =============================================================================
//  新版盐加密（PBKDF2 + 独立 Salt + AES-256-GCM）
//  每用户独立 salt → ENCRYPTION_KEY 泄露后无法彩虹表攻击
//  =============================================================================

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    getMasterKey(),
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  );
}

/** 新格式：每用户独立 salt，返回 { encrypted, salt, iv } */
export function encryptApiKey(plaintext: string): { encrypted: string; salt: string; iv: string } {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // encrypted = ciphertext + tag（16 字节 auth tag）
  return {
    encrypted: Buffer.concat([encrypted, tag]).toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptApiKey(encrypted: string, salt: string, iv: string): string {
  const key = deriveKey(Buffer.from(salt, 'base64'));
  const data = Buffer.from(encrypted, 'base64');
  const tag = data.subarray(-TAG_LENGTH);
  const ciphertext = data.subarray(0, -TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

// =============================================================================
//  兼容解密：自动识别旧 {encrypted, iv, tag} 或新 {encrypted, salt, iv}
//  =============================================================================

export interface LegacyKey {
  encrypted: string
  iv: string
  tag: string
}

export interface SaltedKey {
  encrypted: string
  salt: string
  iv: string
}

/** 自动识别格式并解密 */
export function decryptKeyAuto(stored: LegacyKey | SaltedKey): string {
  if ('salt' in stored && stored.salt) {
    return decryptApiKey(stored.encrypted, stored.salt, stored.iv)
  }
  // 旧格式兼容
  const legacy = stored as LegacyKey
  return decrypt(legacy.encrypted, legacy.iv, legacy.tag)
}
