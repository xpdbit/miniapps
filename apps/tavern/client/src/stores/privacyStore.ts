import { create } from 'zustand'
import Taro from '@tarojs/taro'

const PRIVACY_MODE_KEY = 'tavern_privacy_mode'
const LOCAL_KEYS_KEY = 'tavern_local_api_keys'

interface LocalApiKey {
  provider: string
  keyValue: string
  baseUrl?: string
}

function loadPrivacyMode(): boolean {
  try {
    return Taro.getStorageSync<boolean>(PRIVACY_MODE_KEY) === true
  } catch {
    return false
  }
}

function persistPrivacyMode(enabled: boolean): void {
  try {
    Taro.setStorageSync(PRIVACY_MODE_KEY, enabled)
  } catch {
    // ignore
  }
}

function loadLocalKeys(): Record<string, LocalApiKey> {
  try {
    const data = Taro.getStorageSync<Record<string, LocalApiKey>>(LOCAL_KEYS_KEY)
    return data || {}
  } catch {
    return {}
  }
}

function persistLocalKeys(keys: Record<string, LocalApiKey>): void {
  try {
    Taro.setStorageSync(LOCAL_KEYS_KEY, keys)
  } catch {
    // ignore
  }
}

interface PrivacyState {
  /** 是否启用隐私模式（关闭数据中转，AI 请求直连本地） */
  privacyMode: boolean

  /** 本地缓存的 API Key（按 provider 索引，用于隐私模式直连） */
  localKeys: Record<string, LocalApiKey>

  /** 切换隐私模式 */
  setPrivacyMode: (enabled: boolean) => void

  /** 保存 API Key 到本地缓存 */
  setLocalKey: (provider: string, keyValue: string, baseUrl?: string) => void

  /** 删除本地缓存的 API Key */
  removeLocalKey: (provider: string) => void

  /** 获取指定 provider 的本地 API Key */
  getLocalKey: (provider: string) => LocalApiKey | undefined
}

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  privacyMode: loadPrivacyMode(),
  localKeys: loadLocalKeys(),

  setPrivacyMode: (enabled: boolean) => {
    persistPrivacyMode(enabled)
    set({ privacyMode: enabled })
  },

  setLocalKey: (provider: string, keyValue: string, baseUrl?: string) => {
    const keys = { ...get().localKeys }
    keys[provider] = { provider, keyValue, baseUrl }
    persistLocalKeys(keys)
    set({ localKeys: keys })
  },

  removeLocalKey: (provider: string) => {
    const keys = { ...get().localKeys }
    delete keys[provider]
    persistLocalKeys(keys)
    set({ localKeys: keys })
  },

  getLocalKey: (provider: string) => {
    return get().localKeys[provider]
  },
}))
