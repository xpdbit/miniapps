import { View, Text, Picker } from '@tarojs/components'
import { useEffect, useState, useCallback } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { httpClient } from '@/services/httpClient'
import type { FC } from 'react'
import './index.scss'

/* ========================================================================
 *  ModelSelector — 可复用 AI 模型选择器
 *
 *  用于 game-setup / chat 等需要选择 AI 模型的页面。
 *  自动从服务端加载可用模型列表，失败时降级为内置硬编码列表。
 *  ======================================================================== */

export interface ModelItem {
  modelId: string
  displayName: string
  provider: string
  icon?: string | null
  description?: string | null
  free?: boolean
}

interface ModelsApiResponse {
  code: number
  data: ModelItem[]
  message: string
}

/** 内置兜底模型列表（服务端 API 不可用时使用） */
const FALLBACK_MODELS: ModelItem[] = [
  { modelId: 'deepseek-chat', displayName: 'DeepSeek Chat', provider: 'deepseek', icon: '🧠', free: true },
  { modelId: 'qwen-turbo', displayName: '通义千问 Turbo', provider: 'tongyi', icon: '⚡', free: true },
  { modelId: 'qwen-plus', displayName: '通义千问 Plus', provider: 'tongyi', icon: '✨', free: true },
  { modelId: 'qwen-max', displayName: '通义千问 Max', provider: 'tongyi', icon: '🔥', free: true },
  { modelId: 'big-pickle', displayName: 'Big Pickle', provider: 'opencode', icon: '🥒', free: true },
  { modelId: 'minimax-m2.5-free', displayName: 'MiniMax M2.5 Free', provider: 'opencode', icon: '🆓', free: true },
  { modelId: 'deepseek-v4-flash-free', displayName: 'DeepSeek V4 Flash', provider: 'opencode', icon: '⚙️', free: true },
]

interface ModelSelectorProps {
  /** 紧凑模式：仅显示模型名称，适合在 header 中嵌入 */
  compact?: boolean
  /** 模型切换回调（额外操作，如提示） */
  onModelChange?: (modelId: string, provider: string) => void
  /** 自定义类名 */
  className?: string
}

const ModelSelector: FC<ModelSelectorProps> = ({ compact = false, onModelChange, className = '' }) => {
  const { selectedModel, setModel } = useChatStore()
  const [models, setModels] = useState<ModelItem[]>(FALLBACK_MODELS)
  const [loading, setLoading] = useState(true)

  const loadModels = useCallback(async () => {
    // 未登录用户不调用 API（避免 httpClient 的 401 自动跳转 profile）
    const token = useAuthStore.getState().token
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const res = await httpClient.get<ModelsApiResponse>('/models')
      if (res.code === 0 && res.data && res.data.length > 0) {
        setModels(res.data)
      }
      // If API returns empty (not logged in or no models), keep fallback
    } catch {
      // API 不可用时静默降级，使用内置兜底模型
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  // 确定当前选中的模型信息
  const currentModel = models.find((m) => m.modelId === selectedModel) ?? models[0]
  const modelNames = models.map((m) => `${m.icon || ''} ${m.displayName}`)
  const modelIndex = Math.max(
    0,
    models.findIndex((m) => m.modelId === selectedModel),
  )

  const containerClass = [
    'model-selector',
    compact ? 'model-selector--compact' : '',
    loading ? 'model-selector--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (loading) {
    return (
      <View className={containerClass}>
        <Text className='model-selector__label'>模型</Text>
        <Text className='model-selector__value model-selector__value--loading'>加载中...</Text>
      </View>
    )
  }

  return (
    <View className={containerClass}>
      {!compact && <Text className='model-selector__label'>模型</Text>}
      <Picker
        mode='selector'
        range={modelNames}
        value={modelIndex}
        onChange={(e) => {
          const idx = e.detail.value as unknown as number
          const model = models[idx]
          if (model) {
            setModel(model.modelId, model.provider)
            onModelChange?.(model.modelId, model.provider)
          }
        }}
      >
        <View className='model-selector__trigger'>
          <Text className='model-selector__icon'>
            {currentModel?.icon || '🤖'}
          </Text>
          <Text className='model-selector__name'>
            {currentModel?.displayName || '选择模型'}
          </Text>
          <Text className='model-selector__arrow'>▾</Text>
        </View>
      </Picker>
    </View>
  )
}

export default ModelSelector
