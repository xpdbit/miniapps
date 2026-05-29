import { View, Text, Image, Input, Button, Switch } from '@tarojs/components'
import DesktopSelect from '@/components/DesktopSelect'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { usePrivacyStore } from '@/stores/privacyStore'
import { useGameStore } from '@/stores/gameStore'
import { httpClient } from '@/services/httpClient'
import { Icon } from '@/components'
import { cn, formatUuid } from '@/utils'
import './index.scss'

interface MenuItem {
  icon: string
  label: string
  url: string
  switchTab?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { icon: 'user', label: '我的角色', url: '/pages/character/index' },
  { icon: 'plus', label: '创建角色', url: '/pages/creator/index' },
  { icon: 'persona', label: '人设管理', url: '/pages/persona/index' },
]

interface ApiKey {
  id: string
  provider: string
  baseUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ApiKeyResponse {
  code: number
  data: ApiKey[]
  message: string
}

interface AddKeyResponse {
  code: number
  data: { id: string; provider: string; baseUrl?: string; isActive: boolean; createdAt: string }
  message: string
}

interface AvailableModel {
  modelId: string
  displayName: string
  provider: string
  description: string | null
  icon: string | null
  quotaCost: number
  minTier: string
  free: boolean
}

interface ModelsResponse {
  code: number
  data: AvailableModel[]
  message: string
}

const PROVIDERS = [
  { key: 'tavern', name: '酒馆', icon: '🍺', free: true, desc: '通义千问 / OpenCode Go · 系统免费' },
  { key: 'tongyi', name: '通义千问', icon: 'TY', free: true, desc: 'Qwen Turbo / Plus / Max · 系统免费' },
  { key: 'opencode', name: 'OpenCode Go', icon: 'OC', free: true, desc: '免费AI · Big Pickle / MiniMax M2.5' },
  { key: 'openai', name: 'OpenAI', icon: 'OA', free: false, desc: 'GPT-4o / GPT-4 Turbo' },
  { key: 'anthropic', name: 'Anthropic', icon: 'AN', free: false, desc: 'Claude 3.5 Sonnet / Opus' },
  { key: 'google', name: 'Google', icon: 'GG', free: false, desc: 'Gemini 2.5 Pro / Flash' },
  { key: 'zhipu', name: '智谱AI', icon: 'ZP', free: false, desc: 'GLM-4 / ChatGLM' },
  { key: 'deepseek', name: 'DeepSeek', icon: 'DS', free: false, desc: 'DeepSeek-V3 / R1' },
  { key: 'moonshot', name: '月之暗面', icon: 'MS', free: false, desc: 'Kimi / Moonshot-v1' },
  { key: 'minimax', name: 'MiniMax', icon: 'MM', free: false, desc: 'abab6.5s / abab7' },
  { key: 'openrouter', name: 'OpenRouter', icon: 'OR', free: false, desc: '智能路由最佳模型' },
  { key: 'oneapi', name: 'One API', icon: '1A', free: false, desc: '统一 API 管理 · 自定义部署' },
] as const

/** 酒馆自持服务商（模型来自 ModelMeta seed 数据） */
const TAVERN_PROVIDERS = ['tongyi', 'opencode']

/** 内置兜底模型列表（API 不可用或数据库为空时使用） */
const FALLBACK_MODELS: AvailableModel[] = [
  { modelId: 'qwen-turbo', displayName: '通义千问 Turbo', provider: 'tongyi', description: '快速响应，适合日常对话', icon: '⚡', quotaCost: 1, minTier: 'FREE', free: true },
  { modelId: 'qwen-plus', displayName: '通义千问 Plus', provider: 'tongyi', description: '更强能力，适合复杂任务', icon: '✨', quotaCost: 1, minTier: 'FREE', free: true },
  { modelId: 'qwen-max', displayName: '通义千问 Max', provider: 'tongyi', description: '最强模型，适合极限挑战', icon: '🔥', quotaCost: 2, minTier: 'FREE', free: true },
  { modelId: 'big-pickle', displayName: 'Big Pickle', provider: 'opencode', description: '免费大模型 · OpenCode Go', icon: '🥒', quotaCost: 1, minTier: 'FREE', free: true },
  { modelId: 'minimax-m2.5-free', displayName: 'MiniMax M2.5 Free', provider: 'opencode', description: '免费对话 · OpenCode Go', icon: '🆓', quotaCost: 1, minTier: 'FREE', free: true },
  { modelId: 'deepseek-v4-flash-free', displayName: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go', icon: '⚙️', quotaCost: 1, minTier: 'FREE', free: true },
]

/** 各服务商默认 API Base URL（中国区优先） */
const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  tavern: '',
  tongyi: 'https://dashscope.aliyuncs.com',
  opencode: 'https://opencode.ai/zen/go',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com',
  moonshot: 'https://api.moonshot.cn',
  minimax: 'https://api.minimaxi.com',
  openrouter: 'https://openrouter.ai/api',
  oneapi: '',  // One API 需用户自行填写部署地址
}

export default function ProfilePage() {
  const { user, tier, isLoggedIn, initialized, loginError } = useAuthStore()
  const { selectedModel, setModel } = useChatStore()
  const { privacyMode, setPrivacyMode } = usePrivacyStore()
  const { gameMode, leaveGame, cardsPerRow, setCardsPerRow } = useGameStore()

  const [showModelSection, setShowModelSection] = useState(true)
  const [showKeys, setShowKeys] = useState(false)
  const [showDisplay, setShowDisplay] = useState(true)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [keyValue, setKeyValue] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [models, setModels] = useState<AvailableModel[]>([])
  const [discoveredModels, setDiscoveredModels] = useState<AvailableModel[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [darkMode, setDarkMode] = useState(() => {
    try { return Taro.getStorageSync('tavern_dark_mode') === true || Taro.getStorageSync('tavern_dark_mode') === 'true' } catch { return false }
  })

  const toggleDarkMode = useCallback((value: boolean) => {
    setDarkMode(value)
    try { Taro.setStorageSync('tavern_dark_mode', value) } catch { /* ignore */ }
    Taro.eventCenter.trigger('darkModeChange', value)
  }, [])

  // 防止组件卸载后 setState
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  // 修复 Taro H5 自定义元素 display:none bug — 必须用 !important 内联样式覆盖
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    if (!isLoggedIn) return // 未登录时 header 不渲染，无需修复
    const timer = setTimeout(() => {
      const el = document.querySelector('.page-profile-header') as HTMLElement | null
      if (el?.style) {
        el.style.setProperty('display', 'flex', 'important')
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [isLoggedIn])

  const loadKeys = useCallback(async () => {
    try {
      const res = await httpClient.get<ApiKeyResponse>('/keys')
      if (res.code === 0) {
        setKeys(res.data)
      }
    } catch {
      // ignore
    }
  }, [])

  const loadModels = useCallback(async () => {
    if (modelsLoaded && isLoggedIn) return
    try {
      const res = await httpClient.get<ModelsResponse>('/models')
      if (res.code === 0 && res.data) {
        setModels(res.data)
        setModelsLoaded(true)
      } else if (res.code === 401) {
        // 未登录，静默跳过
        setModelsLoaded(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载模型列表失败'
      console.warn('[profile] loadModels error:', msg)
      setModelsLoaded(false)
    }
  }, [modelsLoaded, isLoggedIn])

  /** 从各服务商 API 发现可用模型 */
  const discoverModels = useCallback(async () => {
    // 只发现非酒馆的自配 Key 服务商
    const keyProviders = keys.filter(k => !TAVERN_PROVIDERS.includes(k.provider))
    if (keyProviders.length === 0) return

    setDiscovering(true)
    const results: AvailableModel[] = []
    await Promise.allSettled(
      keyProviders.map(async (key) => {
        try {
          const res = await httpClient.get<{ code: number; data: AvailableModel[] }>(
            `/models/discover/${key.provider}`
          )
          if (res.code === 0 && res.data) {
            results.push(...res.data)
          }
        } catch {
          // 单个服务商发现失败不影响其他
        }
      })
    )
    // 组件可能已卸载，避免 setState 警告
    if (!isMountedRef.current) return
    if (results.length > 0) {
      setDiscoveredModels(results)
    }
    setDiscovering(false)
  }, [keys])

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2)
    if (isLoggedIn) { loadModels(); loadKeys() }
  })

  // 用户登录状态变化时重新加载 Key 和模型
  useEffect(() => {
    if (isLoggedIn) { loadKeys(); loadModels() }
  }, [isLoggedIn, loadKeys, loadModels])

  // keys 加载完成后自动发现外部服务商模型
  useEffect(() => {
    if (keys.length > 0) discoverModels()
  }, [keys, discoverModels])

  // modal 打开时隐藏底部 tab bar（WeChat 自定义 tabBar 渲染在 page DOM 树外，z-index 无效）
  useEffect(() => {
    Taro.eventCenter.trigger('modalOverlayChange', showModal)
  }, [showModal])

  // 用户登录状态变化时重新加载 Key（useDidShow 闭包可能捕获旧的 isLoggedIn）
  useEffect(() => {
    if (isLoggedIn) loadKeys()
  }, [isLoggedIn, loadKeys])

  // 过滤掉 providerIndex 的边界 case：providerIndex 始终指向 providerNames 中的有效索引
  // 注：当 filterProvider 指向的服务商从 providerNames 中消失时（如删除了唯一 Key 的 PAID 服务商），
  // providerIndex 会回退到 0 ('all')，但 filterProvider 状态不会被重置。首次 Picker 交互即可自动恢复。

  const handleAddKey = useCallback(async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (!selectedProvider || !keyValue.trim()) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    setVerifying(true)
    try {
      const res = await httpClient.post<AddKeyResponse>('/keys', {
        provider: selectedProvider,
        keyValue: keyValue.trim(),
        baseUrl: baseUrl.trim() || undefined,
      })
      if (res.code === 0) {
        // 同时保存到本地缓存（隐私模式直连需要）
        usePrivacyStore.getState().setLocalKey(
          selectedProvider,
          keyValue.trim(),
          baseUrl.trim() || undefined,
        )
        Taro.showToast({ title: '添加成功', icon: 'success' })
        setShowModal(false)
        setKeyValue('')
        setBaseUrl('')
        setSelectedProvider('')
        loadKeys()
      } else {
        Taro.showToast({ title: res.message || '添加失败', icon: 'none' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '添加失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setVerifying(false)
    }
  }, [selectedProvider, keyValue, baseUrl, isLoggedIn, loadKeys])

  const handleDeleteKey = useCallback(async (id: string) => {
    const existKey = keys.find(k => k.id === id)
    if (!existKey) return
    const providerName = PROVIDERS.find(p => p.key === existKey.provider)?.name || existKey.provider
    const modalRes = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除 ${providerName} API Key 吗？`,
    })
    if (!modalRes.confirm) return
    try {
      const res = await httpClient.delete<{ code: number; message: string }>(`/keys/${id}`)
      if (res.code === 0) {
        // 同时清除本地缓存
        usePrivacyStore.getState().removeLocalKey(existKey.provider)
        Taro.showToast({ title: '已删除', icon: 'success' })
        loadKeys()
      } else {
        Taro.showToast({ title: res.message || '删除失败', icon: 'none' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败'
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }, [keys, loadKeys])
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginMode, setLoginMode] = useState<'wechat' | 'password'>(
    process.env.TARO_ENV === 'h5' ? 'password' : 'wechat'
  )
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // H5 环境标记
  const isH5 = process.env.TARO_ENV === 'h5'

  // 微信一键登录
  const handleWechatLogin = useCallback(async () => {
    setLoggingIn(true)
    try {
      let code: string
      try {
        const loginRes = await Taro.login({ timeout: 10000 })
        if (!loginRes.code) throw new Error('未获取到微信授权码')
        code = loginRes.code
      } catch {
        Taro.showToast({ title: '请确认已安装微信', icon: 'none' })
        setLoggingIn(false)
        return
      }
      await useAuthStore.getState().wechatLogin(code)
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setShowLoginForm(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '微信登录失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoggingIn(false)
    }
  }, [])

  // 账号密码登录
  const handlePasswordLogin = useCallback(async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      Taro.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }
    setLoggingIn(true)
    try {
      await useAuthStore.getState().passwordLogin(loginUsername.trim(), loginPassword.trim())
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setShowLoginForm(false)
      setLoginUsername('')
      setLoginPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoggingIn(false)
    }
  }, [loginUsername, loginPassword])
  const nickname = user?.nickname || '酒馆旅人'
  const userUuid = user?.uuid || ''
  const dailyQuota = tier?.maxDailyQuota ?? 20
  const usedQuota = tier?.dailyQuotaUsed ?? 0
  const remaining = Math.max(0, dailyQuota - usedQuota)

  // 服务商 & 模型分组
  // 酒馆自持模型（来自 ModelMeta）+ 外部 API 发现模型合并
  // 如果数据库和发现都为空，降级使用内置兜底模型
  // 按 modelId 去重：发现的模型优先覆盖数据库中的同名模型（信息更新）
  const allModels: AvailableModel[] = (() => {
    if (models.length === 0 && discoveredModels.length === 0 && isLoggedIn) {
      return FALLBACK_MODELS
    }
    const merged = new Map<string, AvailableModel>()
    models.forEach(m => merged.set(m.modelId, m))
    discoveredModels.forEach(m => merged.set(m.modelId, m))
    return [...merged.values()]
  })()
  // 只显示有可用模型或已配置 Key 的服务商
  const modelProviders = new Set(allModels.map(m => m.provider))
  const keyProviders = new Set(keys.map(k => k.provider))
  const visibleProviders = PROVIDERS.filter(p =>
    p.key === 'tavern' || modelProviders.has(p.key) || keyProviders.has(p.key)
  )
  const providerNames = ['all', ...visibleProviders.map(p => p.key)]

  // 'tavern' 是酒馆自持服务商的总称，聚合 tongyi + opencode 的模型
  const tavernModelProviders = new Set(TAVERN_PROVIDERS)
  const filteredModels = filterProvider === 'all'
    ? allModels
    : filterProvider === 'tavern'
      ? allModels.filter(m => tavernModelProviders.has(m.provider))
      : allModels.filter(m => m.provider === filterProvider)
  const modelNames = filteredModels.map(m => m.displayName)
  const hasModelsForProvider = filterProvider === 'all' || filteredModels.length > 0
  const currentModel = allModels.find(m => m.modelId === selectedModel) ?? allModels[0]
  const modelIndex = Math.max(0, filteredModels.findIndex(m => m.modelId === selectedModel))
  const providerIndex = Math.max(0, providerNames.indexOf(filterProvider))
  const configuredCount = keys.length

  const handleNavigate = (item: MenuItem) => {
    if (item.switchTab) {
      Taro.switchTab({ url: item.url })
    } else {
      Taro.navigateTo({ url: item.url })
    }
  }

  return (
    <View className='page-profile'>
      {/* 用户信息卡片（仅已登录显示） */}
      {isLoggedIn && (
      <View className='page-profile-header' style={{ display: 'flex' }}>
        <View className='page-profile-avatar'>
          {user?.avatar_url ? (
            <Image src={user.avatar_url} mode='aspectFill' className='page-profile-avatar-img' />
          ) : (
            <Text className='page-profile-avatar-text'>{nickname?.[0] || '?'}</Text>
          )}
        </View>
        <Text className='page-profile-name'>{nickname}</Text>

        {/* UUID 身份标识 */}
        {userUuid && (
          <Text className='page-profile-uuid'>{formatUuid(userUuid)}</Text>
        )}

        {/* 配额信息 */}
        <View className='page-profile-quota'>
          <View className='page-profile-quota-item'>
            <Text className='page-profile-quota-value page-profile-quota-value--highlight'>
              {remaining}
            </Text>
            <Text className='page-profile-quota-label'>今日剩余</Text>
          </View>
          <View className='page-profile-quota-divider' />
          <View className='page-profile-quota-item'>
            <Text className='page-profile-quota-value'>{dailyQuota}</Text>
            <Text className='page-profile-quota-label'>总次数</Text>
          </View>
        </View>

        {/* 配额进度条 */}
        <View className='page-profile-quota-bar'>
          <View
            className='page-profile-quota-bar-fill'
            style={{
              width: `${dailyQuota > 0 ? (usedQuota / dailyQuota) * 100 : 0}%`,
            }}
          />
        </View>
      </View>
      )}

      {/* 登录入口（仅初始化完成后显示，未登录时展示登录表单）*/}
      {initialized && !isLoggedIn && (
        <View className='page-profile-login-section'>
          {!showLoginForm ? (
            <View className='page-profile-login-prompt'>
              <Icon name='close' size={40} color='var(--color-warning)' />
              <Text className='page-profile-login-prompt-text'>
                {loginError || '登录后可解锁全部功能'}
              </Text>
              <View className='page-profile-login-buttons'>
                {!isH5 && (
                  <Button className='page-profile-login-btn page-profile-login-btn--wechat' onClick={handleWechatLogin} loading={loggingIn} disabled={loggingIn}>
                    微信一键登录
                  </Button>
                )}
                <Button
                  className={`page-profile-login-btn ${isH5 ? 'page-profile-login-btn--password page-profile-login-btn--primary' : 'page-profile-login-btn--password'}`}
                  onClick={() => { setShowLoginForm(true); setLoginMode('password') }}
                  disabled={loggingIn}
                >
                  {isH5 ? '登录 AI 酒馆' : '账号密码登录'}
                </Button>
              </View>
              {isH5 && (
                <Text className='page-profile-login-web-hint'>网页版请使用账号密码登录</Text>
              )}
            </View>
          ) : (
            <View className='page-profile-login-form'>
              <View className='page-profile-login-form-header'>
                <Text className='page-profile-login-form-title'>
                  {loginMode === 'wechat' ? '微信登录' : '账号登录'}
                </Text>
                <Text className='page-profile-login-form-back' onClick={() => { setShowLoginForm(false); setLoginMode(isH5 ? 'password' : 'wechat') }}>
                  返回
                </Text>
              </View>

              {loginMode === 'password' && (
                <View className='page-profile-login-form-body'>
                  <Input
                    className='page-profile-login-input'
                    type='text'
                    placeholder='用户名'
                    value={loginUsername}
                    onInput={e => setLoginUsername(e.detail.value)}
                  />
                  <Input
                    className='page-profile-login-input'
                    type='text'
                    password
                    placeholder='密码'
                    value={loginPassword}
                    onInput={e => setLoginPassword(e.detail.value)}
                  />
                  <Button
                    className='page-profile-login-submit'
                    onClick={handlePasswordLogin}
                    loading={loggingIn}
                    disabled={loggingIn}
                  >
                    登录
                  </Button>
                </View>
              )}

              {loginMode === 'wechat' && !isH5 && (
                <View className='page-profile-login-form-body'>
                  <Text className='page-profile-login-wechat-desc'>
                    点击下方按钮将使用微信账号一键登录
                  </Text>
                  <Button
                    className='page-profile-login-submit page-profile-login-submit--wechat'
                    onClick={handleWechatLogin}
                    loading={loggingIn}
                    disabled={loggingIn}
                  >
                    微信一键登录
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 已登录用户可注销 */}
      {initialized && isLoggedIn && (
        <View className='page-profile-logout-section'>
          <Text
            className='page-profile-logout-text'
            onClick={() => {
              useAuthStore.getState().logout()
              Taro.showToast({ title: '已退出登录', icon: 'none' })
            }}
          >
            退出登录
          </Text>
        </View>
      )}

      {/* 隐私与安全 */}
      <View className='page-profile-section'>
        <View className='page-profile-section-header'>
          <Text className='page-profile-section-title'>隐私与安全</Text>
        </View>
        <View className='page-profile-section-body'>
          {/* 数据中转开关 */}
          <View className='page-profile-privacy-row'>
            <View className='page-profile-privacy-info'>
              <Text className='page-profile-privacy-label'>关闭数据中转</Text>
              <Text className='page-profile-privacy-desc'>
                AI 请求将不再经过服务器，完全由本地直连 AI 服务商。
              </Text>
              <Text className='page-profile-privacy-desc page-profile-privacy-desc--warn'>
                开启后只能使用自己的 API Key，且不支持群组/多人模式。
              </Text>
            </View>
            <Switch
              checked={privacyMode}
              color='#8B5CF6'
              onChange={(e) => {
                const enabled = e.detail.value
                if (enabled) {
                  Taro.showModal({
                    title: '开启隐私模式',
                    content: 'AI 请求将直连服务商，不再经过服务器中转。\n\n仅支持单人模式，需自行配置 API Key。\n\n确定开启吗？',
                    confirmText: '确定开启',
                    cancelText: '取消',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        setPrivacyMode(true)
                        Taro.showToast({ title: '隐私模式已开启', icon: 'success', duration: 2000 })
                      }
                    },
                  })
                } else {
                  setPrivacyMode(false)
                  Taro.showToast({ title: '已恢复默认模式', icon: 'none', duration: 1500 })
                }
              }}
            />
          </View>

          {/* 隐私模式开启后的额外提示 */}
          {privacyMode && (
            <View className='page-profile-privacy-notice'>
              <Icon name='close' size={32} color='var(--color-warning)' />
              <View className='page-profile-privacy-notice-content'>
                <Text className='page-profile-privacy-notice-title'>隐私模式已激活</Text>
                <Text className='page-profile-privacy-notice-desc'>
                  · AI 对话数据不会经过服务器中转{'\n'}
                  · 请确保已在下方配置有效的 API Key{'\n'}
                  · 群组/多人模式功能已禁用
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 暗色模式 */}
      {isLoggedIn && (
        <View className='page-profile-section'>
          <View className='page-profile-model-row'>
            <Text className='page-profile-model-label'>暗色模式</Text>
            <Switch
              checked={darkMode}
              onChange={e => toggleDarkMode(e.detail.value)}
              color='#1677ff'
            />
          </View>
        </View>
      )}

      {/* 模型与服务商 */}
      <View className='page-profile-section'>
        <View className='page-profile-section-header' onClick={() => setShowModelSection(!showModelSection)}>
          <Text className='page-profile-section-title'>模型与服务商</Text>
          <Text className='page-profile-section-arrow'>{showModelSection ? '▼' : '▶'}</Text>
        </View>
        {showModelSection && (
          <View className='page-profile-section-body'>
            {/* 服务商选择 */}
            <View className='page-profile-model-row'>
              <Text className='page-profile-model-label'>服务商</Text>
              <DesktopSelect
                options={providerNames}
                value={providerIndex}
                onChange={(idx) => {
                  setFilterProvider(providerNames[idx] ?? 'all')
                }}
              >
                <View className='page-profile-model-value'>
                  <Text className='page-profile-model-name'>
                    {filterProvider === 'all' ? '全部服务商' : PROVIDERS.find(p => p.key === filterProvider)?.name || filterProvider}
                  </Text>
                  <Icon name='arrow-down' size={24} color='var(--color-icon-muted)' />
                </View>
              </DesktopSelect>
            </View>

            {/* 模型选择 */}
            <View className='page-profile-model-row'>
              <Text className='page-profile-model-label'>当前模型</Text>
              {hasModelsForProvider ? (
                <DesktopSelect
                  options={modelNames}
                  value={modelIndex}
                  onChange={(idx) => {
                    const model = filteredModels[idx]
                    if (model) {
                      setModel(model.modelId, model.provider)
                      Taro.showToast({ title: `已切换为 ${model.displayName}`, icon: 'none', duration: 1500 })
                    }
                  }}
                >
                  <View className='page-profile-model-value'>
                    <Text className='page-profile-model-name'>{currentModel?.displayName || '选择模型'}</Text>
                    <Icon name='arrow-down' size={24} color='var(--color-icon-muted)' />
                  </View>
                </DesktopSelect>
              ) : (
                <View className='page-profile-model-value'>
                  <Text className='page-profile-model-name page-profile-model-name--muted'>该服务商暂无可用模型</Text>
                </View>
              )}
            </View>

            {/* API Key summary */}
            <View className='page-profile-apikey-summary'>
              <Text className='page-profile-apikey-summary-text'>
                API Key: {configuredCount}/{PROVIDERS.length} 已配置
              </Text>
              <Text className='page-profile-apikey-expand' onClick={() => setShowKeys(!showKeys)}>
                {showKeys ? '收起' : '展开 ›'}
              </Text>
            </View>

            {/* Expanded key list */}
            {showKeys && (
              <View className='page-profile-apikey-list'>
                {PROVIDERS.map(provider => {
                  const existKey = keys.find(k => k.provider === provider.key)
                  return (
                    <View key={provider.key} className='page-profile-apikey-item' onClick={() => {
                      if (!existKey) {
                        setSelectedProvider(provider.key)
                        setBaseUrl(PROVIDER_DEFAULT_URLS[provider.key] || '')
                        setShowModal(true)
                      }
                    }}
                    >
                      <Text className='page-profile-apikey-icon'>{provider.icon}</Text>
                      <View className='page-profile-apikey-info'>
                        <Text className='page-profile-apikey-name'>{provider.name}</Text>
                        <Text className='page-profile-apikey-desc'>
                          {existKey
                            ? `配置于 ${new Date(existKey.createdAt).toLocaleDateString('zh-CN')}${existKey.baseUrl ? ` · ${existKey.baseUrl}` : ''}`
                            : provider.free ? '默认可用' : '未配置'}
                        </Text>
                      </View>
                      {existKey ? (
                        <Text className='page-profile-apikey-delete' onClick={(e) => { e.stopPropagation(); handleDeleteKey(existKey.id) }}>
                          删除
                        </Text>
                      ) : (
                        <Text className='page-profile-apikey-add'>
                          {provider.free ? '启用' : '添加'}
                        </Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )}

            {/* 保存配置按钮 */}
            <View className='page-profile-section-save' onClick={() => {
              Taro.showToast({ title: '配置已保存', icon: 'success', duration: 2000 })
            }}
            >
              <Text className='page-profile-section-save-text'>保存配置</Text>
            </View>
          </View>
        )}
      </View>

      {/* 显示设置 */}
      <View className='page-profile-section'>
        <View className='page-profile-section-header' onClick={() => setShowDisplay(!showDisplay)}>
          <Text className='page-profile-section-title'>显示设置</Text>
          <Text className='page-profile-section-arrow'>{showDisplay ? '▼' : '▶'}</Text>
        </View>
        {showDisplay && (
          <View className='page-profile-section-body'>
            <View className='page-profile-model-row'>
              <Text className='page-profile-model-label'>卡片每行数量</Text>
              <DesktopSelect
                options={[1, 2, 3, 4]}
                value={cardsPerRow - 1}
                onChange={(idx) => {
                  setCardsPerRow(idx + 1)
                  Taro.showToast({ title: `已设为每行 ${idx + 1} 张`, icon: 'none', duration: 1200 })
                }}
              >
                <View className='page-profile-model-value'>
                  <Text className='page-profile-model-name'>{cardsPerRow} 张/行</Text>
                  <Icon name='arrow-down' size={24} color='var(--color-icon-muted)' />
                </View>
              </DesktopSelect>
            </View>
          </View>
        )}
      </View>

      {/* 菜单列表 */}
      <View className='page-profile-menu'>
        {MENU_ITEMS.map((item, index) => (
          <View
            key={index}
            className={cn(
              'page-profile-menu-item',
              index === MENU_ITEMS.length - 1 && 'page-profile-menu-item--last',
            )}
            onClick={() => handleNavigate(item)}
          >
            <View className='page-profile-menu-item-left'>
              <Icon name={item.icon as 'user' | 'plus' | 'persona' | 'settings'} size={36} color='var(--color-primary)' />
              <Text className='page-profile-menu-item-label'>{item.label}</Text>
            </View>
            <Text className='page-profile-menu-item-arrow'>›</Text>
          </View>
        ))}
      </View>

      {/* 版本信息 */}
      <View className='page-profile-footer'>
        <Text className='page-profile-footer-text'>AI 酒馆 v1.0.0</Text>
      </View>

      {/* 离开游戏按钮（仅在游戏模式下显示） */}
      {gameMode && (
        <View
          className='page-profile-back-btn'
          onClick={() => {
            Taro.showModal({
              title: '离开游戏',
              content: '离开游戏后，底部导航将恢复为 卡片集/酒馆/我的。确定离开？',
              success: (res) => {
                if (res.confirm) {
                  leaveGame()
                }
              },
            })
          }}
        >
          <Text>离开游戏</Text>
        </View>
      )}

      {/* 添加 Key 弹窗 */}
      {showModal && (
        <View className='page-profile-modal-overlay' onClick={() => setShowModal(false)}>
          <View className='page-profile-modal' onClick={(e) => e.stopPropagation()}>
            <View className='page-profile-modal-header'>
              <Text className='page-profile-modal-title'>添加 API Key</Text>
              <Text className='page-profile-modal-close' onClick={() => setShowModal(false)}>
                <Icon name='close' size={32} color='var(--color-icon-muted)' />
              </Text>
            </View>
            <View className='page-profile-modal-body'>
              <View className='page-profile-modal-form'>
                <View className='page-profile-modal-field'>
                  <Text className='page-profile-modal-label'>服务商</Text>
                  <View className='page-profile-modal-provider'>
                    {PROVIDERS.map(p => (
                      <Text
                        key={p.key}
                        className={`page-profile-modal-provider-option ${selectedProvider === p.key ? 'active' : ''}`}
                        onClick={() => {
                        setSelectedProvider(p.key)
                        setBaseUrl(PROVIDER_DEFAULT_URLS[p.key] || '')
                      }}
                      >
                        {p.icon} {p.name}
                      </Text>
                    ))}
                  </View>
                </View>
                <View className='page-profile-modal-field'>
                  <Text className='page-profile-modal-label'>API Key</Text>
                  <Input
                    className='page-profile-modal-input'
                    type='text'
                    password
                    placeholder='sk-...'
                    value={keyValue}
                    onInput={e => setKeyValue(e.detail.value)}
                  />
                </View>
                <View className='page-profile-modal-field'>
                  <Text className='page-profile-modal-label'>Base URL（可选）</Text>
                  <Input
                    className='page-profile-modal-input'
                    type='text'
                    placeholder='选择服务商后自动填充'
                    value={baseUrl}
                    onInput={e => setBaseUrl(e.detail.value)}
                  />
                </View>
              </View>
              <View className='page-profile-modal-hint'>
                <Text>输入你的 API Key。如需自定义 API 地址，填写 Base URL</Text>
              </View>
            </View>
            <View className='page-profile-modal-footer'>
              <Button className='page-profile-modal-cancel-btn' onClick={() => setShowModal(false)}>取消</Button>
              <Button
                className='page-profile-modal-confirm-btn'
                onClick={handleAddKey}
                disabled={verifying}
              >
                {verifying ? '验证中...' : '添加并验证'}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
