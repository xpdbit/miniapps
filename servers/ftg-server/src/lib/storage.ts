import fs from 'fs/promises';
import path from 'path';

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

// Local filesystem storage provider
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string = 'uploads') {
    this.basePath = path.resolve(basePath);
  }

  async upload(key: string, buffer: Buffer, _mimeType?: string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return `/uploads/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try { await fs.unlink(filePath); } catch { /* ignore */ }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
