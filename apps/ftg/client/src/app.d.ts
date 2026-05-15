/**
 * 全局类型声明
 * 为 Taro 和微信小程序 API 提供类型支持
 */

/// <reference types="@tarojs/taro" />
/// <reference types="wechat-miniprogram" />

// Taro 全局函数声明
declare function definePageConfig(config: Record<string, unknown>): Record<string, unknown>;
declare function defineAppConfig(config: Record<string, unknown>): Record<string, unknown>;

// 扩展 NodeJS 进程环境变量
declare namespace NodeJS {
  interface ProcessEnv {
    /** 当前编译平台 */
    TARO_ENV: 'weapp' | 'h5' | 'alipay' | 'swan' | 'tt' | 'qq' | 'jd' | 'quickapp';
    /** CloudBase 环境 ID */
    CLOUDBASE_ENV_ID: string;
    /** 混元 AI 服务端点 */
    HUNYUAN_ENDPOINT: string;
    /** PP-ShiTuV2 食物识别端点 */
    PPSHITU_ENDPOINT: string;
  }
}

// 微信小程序全局对象声明
declare const wx: WechatMiniprogram.Wx;
