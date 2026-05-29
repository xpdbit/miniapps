import { View, Text, Image, Input, Button, Switch } from '@tarojs/components'
import DesktopSelect from '@/components/DesktopSelect'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
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

export default function ProfilePage() {
  const { user, tier, isLoggedIn, initialized, loginError } = useAuthStore()
  const { selectedModel, setModel } = useChatStore()
  const { gameMode, leaveGame, cardsPerRow, setCardsPerRow } = useGameStore()

  const [showDisplay, setShowDisplay] = useState(true)
  const [models, setModels] = useState<AvailableModel[]>([])
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    try { return Taro.getStorageSync('tavern_dark_mode') === true || Taro.getStorageSync('tavern_dark_mode') === 'true' } catch { return false }
  })

  // AI 模型配置状态
  const [providers, setProviders] = useState<Array<{ provider: string; name: string; isFree: boolean }>>([])
  const [selectedProvider, setSelectedProvider] = useState<string>(useChatStore.getState().selectedProvider || '')
  const [apiKey, setApiKey] = useState('')
  const [verifying, setVerifying] = useState(false)

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

  /** 兜底模型列表 — 覆盖所有主流 Provider，API 不可用或未登录时使用 */
  const FALLBACK_MODELS: AvailableModel[] = [
    { modelId: 'qwen-turbo', displayName: '通义千问 Turbo', provider: 'tongyi', description: '快速响应', icon: '⚡', quotaCost: 1, minTier: 'FREE', free: true },
    { modelId: 'qwen-plus', displayName: '通义千问 Plus', provider: 'tongyi', description: '更强能力', icon: '✨', quotaCost: 1, minTier: 'FREE', free: true },
    { modelId: 'qwen-max', displayName: '通义千问 Max', provider: 'tongyi', description: '最强模型', icon: '🔥', quotaCost: 2, minTier: 'FREE', free: true },
    { modelId: 'big-pickle', displayName: 'Big Pickle', provider: 'opencode', description: '免费大模型', icon: '🥒', quotaCost: 1, minTier: 'FREE', free: true },
    { modelId: 'minimax-m2.5-free', displayName: 'MiniMax M2.5', provider: 'opencode', description: '免费对话', icon: '🆓', quotaCost: 1, minTier: 'FREE', free: true },
    { modelId: 'deepseek-chat', displayName: 'DeepSeek Chat', provider: 'deepseek', description: 'DeepSeek V3', icon: '🐋', quotaCost: 1, minTier: 'FREE', free: true },
    { modelId: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', provider: 'deepseek', description: 'DeepSeek R1', icon: '🧠', quotaCost: 2, minTier: 'FREE', free: true },
    { modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', provider: 'openai', description: 'OpenAI 轻量', icon: '🤖', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'gpt-4o', displayName: 'GPT-4o', provider: 'openai', description: 'OpenAI 旗舰', icon: '🌟', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Anthropic 旗舰', icon: '🧪', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'claude-3-haiku', displayName: 'Claude 3 Haiku', provider: 'anthropic', description: 'Anthropic 轻量', icon: '📝', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'google', description: 'Google 轻量', icon: '💎', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', provider: 'google', description: 'Google 旗舰', icon: '🔮', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'glm-4-flash', displayName: 'GLM-4 Flash', provider: 'zhipu', description: '智谱 轻量', icon: '🌐', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'moonshot-v1-8k', displayName: 'Moonshot v1', provider: 'moonshot', description: '月之暗面', icon: '🌙', quotaCost: 2, minTier: 'PAID', free: false },
    { modelId: 'abab6.5s', displayName: 'MiniMax abab6.5s', provider: 'minimax', description: 'MiniMax 模型', icon: '⚙️', quotaCost: 2, minTier: 'PAID', free: false },
  ]

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return
    try {
      const res = await httpClient.get<ModelsResponse>('/models')
      if (res.code === 0 && res.data) {
        setModels(res.data)
        setModelsLoaded(true)
      } else if (res.code === 401) {
        // 未登录 → 使用兜底模型
        console.log('[profile] 未登录，使用本地模型列表')
        setModels(FALLBACK_MODELS)
        setModelsLoaded(true)
      }
    } catch (err: unknown) {
      console.warn('[profile] loadModels error:', (err as Error).message)
      // 兜底模型列表（API 不可用时使用，涵盖所有主流 Provider）
      setModels(FALLBACK_MODELS)
      setModelsLoaded(true)
    }
  }, [modelsLoaded])

  // 从 API 拉取服务商列表
  useEffect(() => {
    httpClient.get<{ code: number; data: Array<{ provider: string; name: string; isFree: boolean }> }>('/models/providers')
      .then(res => {
        if (!isMountedRef.current) return
        const list = res.data
        if (list && list.length > 0) {
          setProviders(list)
          // 如果当前 selectedProvider 不在列表中，回退到第一个
          if (!list.some((p: { provider: string }) => p.provider === selectedProvider)) {
            setSelectedProvider(list[0]!.provider)
          }
        }
      })
      .catch(() => {
        if (!isMountedRef.current) return
        // Fallback providers
        const fallback = [
          { provider: 'tongyi', name: '通义千问', isFree: true },
          { provider: 'opencode', name: 'OpenCode Go', isFree: true },
          { provider: 'deepseek', name: 'DeepSeek', isFree: true },
        ]
        setProviders(fallback)
        if (fallback.length > 0 && !fallback.some(p => p.provider === selectedProvider)) {
          setSelectedProvider(fallback[0]!.provider)
        }
      })
  }, [])

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2)
    loadModels()
  })

  // 用户登录状态变化时重新加载模型
  useEffect(() => {
    loadModels()
  }, [isLoggedIn, loadModels])

  // 换服务商时清空 API Key
  useEffect(() => {
    setApiKey('')
  }, [selectedProvider])

  // 保存 API Key
  const handleSaveKey = useCallback(async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (!selectedProvider) {
      Taro.showToast({ title: '请选择服务商', icon: 'none' })
      return
    }
    if (!apiKey.trim()) {
      Taro.showToast({ title: '请输入 API Key', icon: 'none' })
      return
    }
    setVerifying(true)
    try {
      const res = await httpClient.post<{ code: number; message: string }>('/keys', {
        provider: selectedProvider,
        keyValue: apiKey.trim(),
      })
      if (res.code === 0) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        Taro.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setVerifying(false)
    }
  }, [selectedProvider, apiKey, isLoggedIn])

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

  // 按选中服务商过滤模型
  const providerModels = selectedProvider
    ? models.filter(m => m.provider === selectedProvider)
    : models
  const modelNames = providerModels.map(m => m.displayName)
  const currentModel = providerModels.find(m => m.modelId === selectedModel) ?? providerModels[0]
  const modelIndex = Math.max(0, providerModels.findIndex(m => m.modelId === selectedModel))
  const currentProviderInfo = providers.find(p => p.provider === selectedProvider)
  const isFreeProvider = currentProviderInfo?.isFree ?? true

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

      {/* AI 模型配置 */}
      <View className='page-profile-section'>
        <View className='page-profile-section-header'>
          <Text className='page-profile-section-title'>AI 模型配置</Text>
        </View>
        <View className='page-profile-section-body'>
          {/* 服务商选择 */}
          <View className='page-profile-model-row'>
            <Text className='page-profile-model-label'>服务商</Text>
            <DesktopSelect
              options={providers.map(p => p.name)}
              value={Math.max(0, providers.findIndex(p => p.provider === selectedProvider))}
              onChange={(idx) => {
                const newProvider = providers[idx]?.provider
                if (newProvider) {
                  setSelectedProvider(newProvider)
                  // 自动切换模型到该服务商的第一个可用模型
                  const providerModelList = models.filter(m => m.provider === newProvider)
                  if (providerModelList.length > 0) {
                    setModel(providerModelList[0]!.modelId, newProvider)
                  }
                }
              }}
            >
              <View className='page-profile-model-value'>
                <Text className='page-profile-model-name'>
                  {currentProviderInfo?.name || '选择服务商'}
                </Text>
                <Icon name='arrow-down' size={24} color='var(--color-icon-muted)' />
              </View>
            </DesktopSelect>
          </View>

          {/* 模型选择 */}
          <View className='page-profile-model-row'>
            <Text className='page-profile-model-label'>模型</Text>
            {providerModels.length > 0 ? (
              <DesktopSelect
                options={modelNames}
                value={modelIndex}
                onChange={(idx) => {
                  const model = providerModels[idx]
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

          {/* API Key（仅付费服务商显示） */}
          {!isFreeProvider && (
            <View className='page-profile-model-row'>
              <Text className='page-profile-model-label'>API Key</Text>
              <Input
                className='page-profile-modal-input'
                type='text'
                password
                placeholder='sk-...'
                value={apiKey}
                onInput={e => setApiKey(e.detail.value)}
                style={{ width: '240rpx', textAlign: 'right' }}
              />
            </View>
          )}

          {/* 保存按钮 */}
          <View
            className='page-profile-section-save'
            onClick={handleSaveKey}
          >
            <Text className='page-profile-section-save-text'>
              {verifying ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>
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
    </View>
  )
}
