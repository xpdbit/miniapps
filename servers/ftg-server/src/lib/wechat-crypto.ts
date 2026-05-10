import crypto from 'node:crypto';

/**
 * 微信用户信息加密数据结构
 */
export interface WechatUserInfo {
  nickName: string;
  avatarUrl: string;
  gender?: number;
  country?: string;
  province?: string;
  city?: string;
  language?: string;
}

/**
 * 微信加密数据解密（AES-128-CBC + PKCS7 填充）
 *
 * 微信开放数据的加密方案:
 *   - 算法: AES-128-CBC
 *   - 密钥: session_key（base64 编码，解码后为 16 字节）
 *   - IV: 接口返回的 iv（base64 编码，解码后为 16 字节）
 *   - 密文: encryptedData（base64 编码）
 *   - 填充方式: PKCS7
 *
 * 解密后的结果为 JSON 字符串，包含 nickName、avatarUrl 等用户信息。
 *
 * @param encryptedData - 微信接口返回的加密数据（base64）
 * @param iv - 微信接口返回的初始向量（base64）
 * @param sessionKey - 微信 jscode2session 返回的会话密钥（base64）
 * @returns 解密后的用户信息对象
 * @throws 解密失败时抛出描述性错误
 */
export function decryptWechatData(
  encryptedData: string,
  iv: string,
  sessionKey: string,
): WechatUserInfo {
  // 解码 base64 输入
  const keyBuffer = Buffer.from(sessionKey, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');

  // 验证密钥长度（AES-128 需要 16 字节密钥）
  if (keyBuffer.length !== 16) {
    throw new Error(`session_key 解码后长度无效: 期望 16 字节，实际 ${keyBuffer.length} 字节`);
  }

  // 验证 IV 长度（AES-CBC 需要 16 字节 IV）
  if (ivBuffer.length !== 16) {
    throw new Error(`iv 解码后长度无效: 期望 16 字节，实际 ${ivBuffer.length} 字节`);
  }

  // 验证密文非空
  if (encryptedBuffer.length === 0) {
    throw new Error('encryptedData 解码后为空');
  }

  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, ivBuffer);
    decipher.setAutoPadding(true); // PKCS7 由 Node.js 自动处理

    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    const decoded = decrypted.toString('utf8');
    const result: WechatUserInfo = JSON.parse(decoded);

    // 验证必要字段
    if (!result.nickName || !result.avatarUrl) {
      throw new Error('解密结果缺少必要字段 nickName 或 avatarUrl');
    }

    return result;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('微信数据解密失败: 解密结果不是有效的 JSON');
    }
    if (error instanceof Error && error.message.includes('bad decrypt')) {
      throw new Error('微信数据解密失败: session_key 无效或数据被篡改');
    }
    throw new Error(
      `微信数据解密失败: ${error instanceof Error ? error.message : '未知错误'}`,
    );
  }
}


