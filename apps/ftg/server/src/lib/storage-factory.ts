import { env } from '../config/env';
import { StorageProvider, LocalStorageProvider } from './storage';
import { ossUpload, ossDownload, ossDelete } from './oss';
import logger from '../utils/logger';

class OSSStorageProvider implements StorageProvider {
  async upload(key: string, buffer: Buffer, mimeType?: string): Promise<string> {
    return ossUpload(key, buffer, mimeType);
  }
  async download(key: string): Promise<Buffer> {
    return ossDownload(key);
  }
  async delete(key: string): Promise<void> {
    return ossDelete(key);
  }
  getUrl(key: string): string {
    return key; // OSS returns full URL
  }
}

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    if (provider === 'oss') {
      logger.info('Using OSS storage provider');
      storageInstance = new OSSStorageProvider();
    } else {
      logger.info('Using local storage provider');
      storageInstance = new LocalStorageProvider();
    }
  }
  return storageInstance;
}

export function buildStoragePath(userId: number, category: string, ext: string = 'jpg'): string {
  const ts = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${category}/${userId}/${ts}_${random}.${ext}`;
}
