import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBytes = Buffer.from(config.encryptionKey.slice(0, 64).padEnd(64, '0'), 'hex').slice(0, 32);
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
  const keyBytes = Buffer.from(config.encryptionKey.slice(0, 64).padEnd(64, '0'), 'hex').slice(0, 32);
  const ivBytes = Buffer.from(iv, 'hex');
  const tagBytes = Buffer.from(tag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBytes, ivBytes);
  decipher.setAuthTag(tagBytes);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
