/**
 * ============================================================
 * 认证状态管理 (Zustand)
 * 管理 JWT token、用户信息、登录态的持久化
 * ============================================================
 *
 * 初始化流程:
 * 1. 检查 Taro Storage 中是否有 token
 * 2. 有 token → GET /auth/me 验证有效性
 *    - 有效 → 更新 store（isAuthenticated = true）
 *    - 无效（401）→ 清除 token，走重新登录流程
 * 3. 无 token → wx.login() → POST /auth/login → 自动注册+登录
 * 4. 全部完成后设置 initialized = true
 */

import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { loginWithWechat, fetchCurrentUser } from '@/services/authService';
import type { AuthUser } from '@/types/user';

/** Taro Storage 中的 token 键名 */
const TOKEN_KEY = 'auth_token';

/** Auth Store 状态接口 */
interface AuthState {
  /** JWT 令牌 */
  token: string | null;
  /** 当前用户信息 */
  user: AuthUser | null;
  /** 是否已通过认证（有有效 token） */
  isAuthenticated: boolean;
  /** 是否已完成初始化 */
  initialized: boolean;

  /**
   * 初始化认证状态
   *
   * 在 app 启动时调用一次：
   * 1. 检查已存储的 token
   * 2. 有 token → 验证 → 有效则恢复会话
   * 3. 无 token / 失效 → wx.login() → 自动注册
   */
  initialize: () => Promise<void>;

  /**
   * 微信登录
   *
   * 调用 wx.login() 获取临时 code，
   * 再请求服务端 POST /auth/login 完成认证。
   */
  login: () => Promise<void>;

  /**
   * 生成 Mock code（供内部使用）
   */
  _generateMockCode: () => string;

  /**
   * 登出
   *
   * 清除 token 和用户信息，isAuthenticated 置为 false。
   */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    try {
      const storedToken = Taro.getStorageSync<string | null>(TOKEN_KEY);

      if (storedToken) {
        // 有存储的 token → 验证有效性（使用 httpClient 原生超时 8 秒）
        try {
          const user = await fetchCurrentUser(storedToken, 8000);
          set({
            token: storedToken,
            user,
            isAuthenticated: true,
            initialized: true,
          });
          return;
        } catch {
          // token 无效/过期/超时 → 清除后重新登录
          Taro.removeStorageSync(TOKEN_KEY);
        }
      }

      // 无 token 或 token 失效 → 自动微信登录 + 注册
      // login() 内部各步骤有独立超时（Taro.login 10秒、服务端登录 15秒）
      await get().login();
    } catch (error) {
      console.error('[AuthStore] 初始化失败:', error);
      // 用户可见的错误提示
      const errMsg = error instanceof Error ? error.message : String(error);
      // httpClient 已转换错误为中文并包含详细诊断，直接显示给用户
      const isConnectionError =
        errMsg.includes('无法连接到服务器') ||
        errMsg.includes('SSL 证书验证失败') ||
        errMsg.includes('DNS 解析失败') ||
        errMsg.includes('服务器连接被拒绝') ||
        errMsg.includes('请求超时') ||
        errMsg.includes('request:fail') ||
        errMsg.includes('ERR_CONNECTION_REFUSED') ||
        errMsg.includes('Network Error');
      const isConfigError =
        errMsg.includes('WECHAT_APPID') ||
        errMsg.includes('WECHAT_SECRET') ||
        errMsg.includes('AppID') ||
        errMsg.includes('AppSecret');
      if (isConnectionError) {
        // 直接显示 httpClient 的详细诊断信息（连接拒绝/DNS/SSL/超时等）
        Taro.showToast({
          title: errMsg.length > 30 ? errMsg.substring(0, 28) + '…' : errMsg,
          icon: 'none',
          duration: 3000,
        });
      } else if (isConfigError) {
        Taro.showToast({
          title: '登录配置错误，请联系管理员',
          icon: 'none',
          duration: 3000,
        });
      } else {
        // 静默失败 — 不阻塞用户浏览，页面通过 OpenData 展示微信原生昵称/头像
        console.warn('[AuthStore] 登录失败，用户在未登录状态下使用');
      }
    } finally {
      set({ initialized: true });
    }
  },

  /**
   * 生成 Mock code（服务端 dev_ 前缀路径在任意 NODE_ENV 下均返回 Mock Session）
   */
  _generateMockCode: (): string => {
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  login: async () => {
    let code: string;

    // TARO_APP_MOCK_AUTH=true 时完全跳过 wx.login()，直接使用 Mock code
    if (process.env.TARO_APP_MOCK_AUTH === 'true') {
      console.info('[AuthStore] TARO_APP_MOCK_AUTH=true，使用 Mock 登录');
      code = get()._generateMockCode();
    } else {
      // 1. 调用 wx.login() 获取临时 code（10秒超时，防止微信基础库卡住）
      try {
        const loginRes = await Taro.login({ timeout: 10000 });
        if (loginRes.code) {
          code = loginRes.code;
        } else {
          throw new Error('微信登录失败: 未获取到临时 code');
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[AuthStore] wx.login() 失败，尝试 Mock 降级:', errMsg);
        code = get()._generateMockCode();
      }
    }

    try {
      // 2. 请求服务端认证（首次使用自动注册，httpClient 原生超时 15 秒）
      const result = await loginWithWechat(code, 15000);

      // 3. 持久化 token + 更新 store
      Taro.setStorageSync(TOKEN_KEY, result.token);
      set({
        token: result.token,
        user: result.user,
        isAuthenticated: true,
      });
    } catch (err) {
      // 真实 code 登录失败 → 降级使用 Mock code 重试一次
      if (!code.startsWith('dev_') && !code.startsWith('test_')) {
        console.warn('[AuthStore] 服务端登录失败，降级 Mock 重试:', (err as Error).message);
        try {
          const mockCode = get()._generateMockCode();
          const result = await loginWithWechat(mockCode);
          Taro.setStorageSync(TOKEN_KEY, result.token);
          set({
            token: result.token,
            user: result.user,
            isAuthenticated: true,
          });
          return;
        } catch (mockErr) {
          // Mock 降级也失败 → 抛出原始错误（保留真实原因）
          console.error('[AuthStore] Mock 降级亦失败:', (mockErr as Error).message);
          throw err;
        }
      }
      throw err;
    }
  },

  logout: () => {
    Taro.removeStorageSync(TOKEN_KEY);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
