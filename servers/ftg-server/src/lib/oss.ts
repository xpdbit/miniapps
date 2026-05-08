import OSS from 'ali-oss';
import { env } from '../config/env';
import logger from '../utils/logger';

let ossClient: OSS | null = null;

function getOSSClient(): OSS | null {
  if (!env.OSS_ACCESS_KEY_ID || !env.OSS_ACCESS_KEY_SECRET) {
    logger.warn('OSS credentials not configured');
    return null;
  }
  if (!ossClient) {
    ossClient = new OSS({
      region: env.OSS_REGION,
      bucket: env.OSS_BUCKET,
      accessKeyId: env.OSS_ACCESS_KEY_ID,
      accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
    });
  }
  return ossClient;
}

export async function ossUpload(key: string, buffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
  const client = getOSSClient();
  if (!client) throw new Error('OSS client not available');
  const result = await client.put(key, buffer, { mime: mimeType });
  return result.url;
}

export async function ossDownload(key: string): Promise<Buffer> {
  const client = getOSSClient();
  if (!client) throw new Error('OSS client not available');
  const result = await client.get(key);
  return result.content as unknown as Buffer;
}

export async function ossDelete(key: string): Promise<void> {
  const client = getOSSClient();
  if (!client) throw new Error('OSS client not available');
  await client.delete(key);
}

export default getOSSClient;
