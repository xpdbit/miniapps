import { View, Text, Image, Input, Button, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
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

interface ModelOption {
  id: string
  name: string
  provider: string
  description: string
  icon: string
  free: boolean
}

const PROVIDERS = [
  { key: 'opencode', name: 'OpenCode Go', icon: 'OC', free: true, desc: '免费AI · Big Pickle / MiniMax M2.5' },
  { key: 'openai', name: 'OpenAI', icon: 'OA', free: false, desc: 'GPT-4o / GPT-4 Turbo' },
  { key: 'anthropic', name: 'Anthropic', icon: 'AN', free: false, desc: 'Claude 3.5 Sonnet / Opus' },
  { key: 'google', name: 'Google', icon: 'GG', free: false, desc: 'Gemini 2.5 Pro / Flash' },
  { key: 'zhipu', name: '智谱AI', icon: 'ZP', free: false, desc: 'GLM-4 / ChatGLM' },
  { key: 'deepseek', name: 'DeepSeek', icon: 'DS', free: false, desc: 'DeepSeek-V3 / R1' },
  { key: 'moonshot', name: '月之暗面', icon: 'MS', free: false, desc: 'Kimi / Moonshot-v1' },
  { key: 'minimax', name: 'MiniMax', icon: 'MM', free: false, desc: 'abab6.5s / abab7' },
] as const

/** 各服务商默认 API Base URL（中国区优先） */
const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  opencode: 'https://opencode.ai/zen/go',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com',
  moonshot: 'https://api.moonshot.cn',
  minimax: 'https://api.minimaxi.com',
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'qwen-turbo', name: '通义千问 Turbo', provider: 'tongyi', description: '快速响应，适合日常对话', icon: '⚡', free: true },
  { id: 'qwen-plus', name: '通义千问 Plus', provider: 'tongyi', description: '更强能力，适合复杂任务', icon: '✨', free: true },
  { id: 'qwen-max', name: '通义千问 Max', provider: 'tongyi', description: '最强模型，适合极限挑战', icon: '🔥', free: true },
  { id: 'big-pickle', name: 'Big Pickle', provider: 'opencode', description: '免费大模型 · OpenCode Go', icon: '🥒', free: true },
  { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', provider: 'opencode', description: '免费对话 · OpenCode Go', icon: '🆓', free: true },
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go', icon: '⚙️', free: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: '多模态旗舰模型', icon: '🧠', free: false },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: '高性能推理', icon: '💎', free: false },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', description: '国产开源，代码能力强', icon: '🐋', free: false },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', description: '深度推理，复杂问题克星', icon: '🔍', free: false },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: '平衡性能与速度', icon: '🎭', free: false },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', description: '最强分析推理', icon: '🏛️', free: false },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', description: 'Google 旗舰模型', icon: '🌐', free: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: '轻量快速响应', icon: '⚡', free: false },
  { id: 'glm-4', name: 'GLM-4', provider: 'zhipu', description: '智谱旗舰大模型', icon: '🔮', free: false },
  { id: 'chatglm-turbo', name: 'ChatGLM Turbo', provider: 'zhipu', description: '轻量高效推理', icon: '💨', free: false },
  { id: 'moonshot-v1-8k', name: 'Kimi 8K', provider: 'moonshot', description: '长上下文理解', icon: '🌙', free: false },
  { id: 'moonshot-v1-32k', name: 'Kimi 32K', provider: 'moonshot', description: '超长上下文处理', icon: '🌕', free: false },
  { id: 'abab6.5s', name: 'abab6.5s', provider: 'minimax', description: 'MiniMax 快速模型', icon: '🎯', free: false },
  { id: 'abab7', name: 'abab7', provider: 'minimax', description: 'MiniMax 旗舰模型', icon: '🚀', free: false },
  { id: 'openrouter-auto', name: 'OpenRouter Auto', provider: 'openrouter', description: '智能路由最佳模型', icon: '🔀', free: false },
]

const MODEL_NAMES = MODEL_OPTIONS.map(m => m.name)

export default function ProfilePage() {
  const { user } = useAuthStore()
  const { selectedModel, setModel } = useChatStore()

  const [showModelSection, setShowModelSection] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [keyValue, setKeyValue] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2)
    loadKeys()
  })

  // modal 打开时隐藏底部 tab bar（WeChat 自定义 tabBar 渲染在 page DOM 树外，z-index 无效）
  useEffect(() => {
    Taro.eventCenter.trigger('modalOverlayChange', showModal)
  }, [showModal])

  const handleAddKey = useCallback(async () => {
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
  }, [selectedProvider, keyValue, loadKeys])

  const handleDeleteKey = useCallback(async (id: string) => {
    const existKey = keys.find(k => k.id === id)
    if (!existKey) return
    const providerName = PROVIDERS.find(p => p.key === existKey.provider)?.name || existKey.provider
    const modalRes = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除 ${providerName} API Key 吗？`,
    })
    if (!modalRes.confirm) return
    setDeletingId(id)
    try {
      const res = await httpClient.delete<{ code: number; message: string }>(`/keys/${id}`)
      if (res.code === 0) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        loadKeys()
      } else {
        Taro.showToast({ title: res.message || '删除失败', icon: 'none' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setDeletingId(null)
    }
  }, [keys, loadKeys])
  const nickname = user?.nickname || '酒馆旅人'
  const userUuid = user?.uuid || ''
  const dailyQuota = user?.dailyQuota ?? 20
  const usedQuota = user?.usedQuota ?? 0
  const remaining = Math.max(0, dailyQuota - usedQuota)
  const currentModel = MODEL_OPTIONS.find(m => m.id === selectedModel) ?? MODEL_OPTIONS[0]
  const modelIndex = Math.max(0, MODEL_OPTIONS.findIndex(m => m.id === selectedModel))
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
      {/* 用户信息卡片 */}
      <View className='page-profile-header'>
        <View className='page-profile-avatar'>
          {user?.avatar ? (
            <Image src={user.avatar} mode='aspectFill' className='page-profile-avatar-img' />
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

      {/* 模型与服务商 */}
      <View className='page-profile-section'>
        <View className='page-profile-section-header' onClick={() => setShowModelSection(!showModelSection)}>
          <Text className='page-profile-section-title'>模型与服务商</Text>
          <Text className='page-profile-section-arrow'>{showModelSection ? '▼' : '▶'}</Text>
        </View>
        {showModelSection && (
          <View className='page-profile-section-body'>
            {/* Model picker */}
            <View className='page-profile-model-row'>
              <Text className='page-profile-model-label'>当前模型</Text>
              <Picker
                mode='selector'
                range={MODEL_NAMES}
                value={modelIndex}
                onChange={(e) => {
                  const idx = e.detail.value as number
                  const model = MODEL_OPTIONS[idx]
                  if (model) {
                    setModel(model.id)
                    Taro.showToast({ title: `模型已切换为 ${model.name}`, icon: 'none', duration: 1500 })
                  }
                }}
              >
                <View className='page-profile-model-value'>
                  <Text className='page-profile-model-name'>{currentModel?.name || '选择模型'}</Text>
                  <Icon name='arrow-down' size={24} color='#999' />
                </View>
              </Picker>
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
            }}>
              <Text className='page-profile-section-save-text'>保存配置</Text>
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
              <Icon name={item.icon as 'user' | 'plus' | 'persona' | 'settings'} size={36} color='#C49A6C' />
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

      {/* 添加 Key 弹窗 */}
      {showModal && (
        <View className='page-profile-modal-overlay' onClick={() => setShowModal(false)}>
          <View className='page-profile-modal' onClick={(e) => e.stopPropagation()}>
            <View className='page-profile-modal-header'>
              <Text className='page-profile-modal-title'>添加 API Key</Text>
              <Text className='page-profile-modal-close' onClick={() => setShowModal(false)}>
                <Icon name='close' size={32} color='#999' />
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
