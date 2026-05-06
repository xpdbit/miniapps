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
        // 有存储的 token → 验证有效性
        try {
          const user = await fetchCurrentUser(storedToken);
          set({
            token: storedToken,
            user,
            isAuthenticated: true,
            initialized: true,
          });
          return;
        } catch {
          // token 无效或过期 → 清除后重新登录
          Taro.removeStorageSync(TOKEN_KEY);
        }
      }

      // 无 token 或 token 失效 → 自动微信登录 + 注册
      await get().login();
    } catch (error) {
      console.error('[AuthStore] 初始化失败:', error);
      // 用户可见的错误提示
      const errMsg = error instanceof Error ? error.message : String(error);
      // httpClient 已转换错误为中文，需同时检查中英文关键词
      const isConnectionError =
        errMsg.includes('无法连接到服务器') ||
        errMsg.includes('request:fail') ||
        errMsg.includes('ERR_CONNECTION_REFUSED') ||
        errMsg.includes('Network Error');
      if (isConnectionError) {
        Taro.showToast({
          title: '无法连接到服务器，请检查网络或稍后重试',
          icon: 'none',
          duration: 3000,
        });
      } else {
        Taro.showToast({
          title: '登录失败，请重试',
          icon: 'none',
          duration: 2000,
        });
      }
    } finally {
      set({ initialized: true });
    }
  },

  login: async () => {
    // 1. 调用 wx.login() 获取临时 code
    const loginRes = await Taro.login();
    if (!loginRes.code) {
      throw new Error('微信登录失败: 未获取到临时 code');
    }

    // 2. 请求服务端认证（首次使用自动注册）
    const result = await loginWithWechat(loginRes.code);

    // 3. 持久化 token + 更新 store
    Taro.setStorageSync(TOKEN_KEY, result.token);
    set({
      token: result.token,
      user: result.user,
      isAuthenticated: true,
    });
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
