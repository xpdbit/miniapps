declare module 'ali-oss' {
  import { Readable } from 'stream';

  interface OSSOptions {
    region: string;
    bucket?: string;
    accessKeyId: string;
    accessKeySecret: string;
    internal?: boolean;
    secure?: boolean;
    timeout?: string | number;
  }

  interface PutObjectResult {
    name: string;
    url: string;
    res: Record<string, unknown>;
  }

  interface GetObjectResult {
    content: Buffer;
    res: Record<string, unknown>;
  }

  interface DeleteObjectResult {
    res: Record<string, unknown>;
  }

  interface ListObjectResult {
    objects: Array<{
      name: string;
      url: string;
      lastModified: string;
      etag: string;
      type: string;
      size: number;
      storageClass: string;
      owner: { id: string; displayName: string };
    }>;
    prefixes: string[];
    isTruncated: boolean;
    nextMarker: string;
    res: Record<string, unknown>;
  }

  class OSS {
    constructor(options: OSSOptions);

    put(name: string, file: string | Buffer | Readable, options?: Record<string, unknown>): Promise<PutObjectResult>;
    get(name: string, options?: Record<string, unknown>): Promise<GetObjectResult>;
    delete(name: string, options?: Record<string, unknown>): Promise<DeleteObjectResult>;
    list(query?: Record<string, unknown>, options?: Record<string, unknown>): Promise<ListObjectResult>;
    putBucket(name: string, region: string): Promise<Record<string, unknown>>;
    deleteBucket(name: string, region: string): Promise<Record<string, unknown>>;

    generateObjectUrl(name: string, expires?: number): string;
    signatureUrl(name: string, options?: Record<string, unknown>): string;
  }

  export = OSS;
}
