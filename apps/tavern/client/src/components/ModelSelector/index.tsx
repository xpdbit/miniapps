import { View, Text, Picker } from '@tarojs/components'
import type { PickerSelectorProps } from '@tarojs/components/types/Picker'
import { useChatStore } from '@/stores/chatStore'
import { Icon } from '@/components'
import './index.scss'

/**
 * 模型选项配置
 */
interface ModelOption {
  id: string
  name: string
  provider: string
  description: string
  icon: string
  free: boolean
}

// 可用模型列表
const MODEL_OPTIONS: ModelOption[] = [
  // ── 免费默认（通义千问） ──
  { id: 'qwen-turbo', name: '通义千问 Turbo', provider: 'tongyi', description: '快速响应，适合日常对话', icon: '⚡', free: true },
  { id: 'qwen-plus', name: '通义千问 Plus', provider: 'tongyi', description: '更强能力，适合复杂任务', icon: '✨', free: true },
  { id: 'qwen-max', name: '通义千问 Max', provider: 'tongyi', description: '最强模型，适合极限挑战', icon: '🔥', free: true },
  // ── OpenCode Go 免费 ──
  { id: 'big-pickle', name: 'Big Pickle', provider: 'opencode', description: '免费大模型 · OpenCode Go', icon: '🥒', free: true },
  { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', provider: 'opencode', description: '免费对话 · OpenCode Go', icon: '🆓', free: true },
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash', provider: 'opencode', description: '免费推理 · OpenCode Go', icon: '⚙️', free: true },
  // ── OpenAI ──
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: '多模态旗舰模型', icon: '🧠', free: false },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: '高性能推理', icon: '💎', free: false },
  // ── DeepSeek ──
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', description: '国产开源，代码能力强', icon: '🐋', free: false },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', description: '深度推理，复杂问题克星', icon: '🔍', free: false },
  // ── Anthropic ──
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: '平衡性能与速度', icon: '🎭', free: false },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', description: '最强分析推理', icon: '🏛️', free: false },
  // ── Google ──
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', description: 'Google 旗舰模型', icon: '🌐', free: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: '轻量快速响应', icon: '⚡', free: false },
  // ── 智谱AI ──
  { id: 'glm-4', name: 'GLM-4', provider: 'zhipu', description: '智谱旗舰大模型', icon: '🔮', free: false },
  { id: 'chatglm-turbo', name: 'ChatGLM Turbo', provider: 'zhipu', description: '轻量高效推理', icon: '💨', free: false },
  // ── 月之暗面 ──
  { id: 'moonshot-v1-8k', name: 'Kimi 8K', provider: 'moonshot', description: '长上下文理解', icon: '🌙', free: false },
  { id: 'moonshot-v1-32k', name: 'Kimi 32K', provider: 'moonshot', description: '超长上下文处理', icon: '🌕', free: false },
  // ── MiniMax ──
  { id: 'abab6.5s', name: 'abab6.5s', provider: 'minimax', description: 'MiniMax 快速模型', icon: '🎯', free: false },
  { id: 'abab7', name: 'abab7', provider: 'minimax', description: 'MiniMax 旗舰模型', icon: '🚀', free: false },
  // ── OpenRouter ──
  { id: 'openrouter-auto', name: 'OpenRouter Auto', provider: 'openrouter', description: '智能路由最佳模型', icon: '🔀', free: false },
]

// Picker 需要 range 数组（只显示名称）
const MODEL_NAMES = MODEL_OPTIONS.map(m => m.name)

export default function ModelSelector() {
  const selectedModel = useChatStore((state) => state.selectedModel)
  const setModel = useChatStore((state) => state.setModel)

  const current = MODEL_OPTIONS.find(m => m.id === selectedModel) ?? MODEL_OPTIONS[0]!
  const selectedIndex = Math.max(0, MODEL_OPTIONS.findIndex(m => m.id === selectedModel))

  const handleChange: PickerSelectorProps['onChange'] = (e) => {
    const idx = e.detail.value as unknown as number
    if (typeof idx === 'number' && idx >= 0 && idx < MODEL_OPTIONS.length) {
      const m = MODEL_OPTIONS[idx]
      if (m) setModel(m.id)
    }
  }

  return (
    <View className='model-selector'>
      <Picker
        mode='selector'
        range={MODEL_NAMES}
        value={selectedIndex >= 0 ? selectedIndex : 0}
        onChange={handleChange}
      >
        <View className='model-selector__trigger'>
          <Text className='model-selector__label'>模型</Text>
          <View className='model-selector__value'>
            <Text className='model-selector__icon'>{current.icon}</Text>
            <Text className='model-selector__name'>{current.name}</Text>
            {current.free && <Text className='model-selector__badge'>免费</Text>}
            <Icon name='arrow-down' size={24} color='#999' />
          </View>
        </View>
      </Picker>
    </View>
  )
}
