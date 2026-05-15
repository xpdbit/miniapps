import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { cn } from '@/utils'
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
}

// 可用模型列表
const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'qwen-turbo',
    name: '通义千问',
    provider: 'qwen-turbo',
    description: '快速响应，适合日常对话',
    icon: 'fast',
  },
  {
    id: 'qwen-plus',
    name: 'Plus',
    provider: 'qwen-plus',
    description: '更强能力，适合复杂任务',
    icon: 'plus',
  },
  {
    id: 'qwen-max',
    name: 'Max',
    provider: 'qwen-max',
    description: '最强模型，适合极限挑战',
    icon: 'max',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek-chat',
    description: '国产开源，代码能力强',
    icon: 'v3',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek-reasoner',
    description: '深度推理，复杂问题克星',
    icon: 'r1',
  },
]

// 获取当前选中模型的显示名称
function getSelectedModelName(modelId: string): string {
  const model = MODEL_OPTIONS.find((m) => m.id === modelId)
  return model ? model.name : '\u2699 选择模型'
}

export default function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const selectedModel = useChatStore((state) => state.selectedModel)
  const setModel = useChatStore((state) => state.setModel)

  // 切换下拉菜单
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev)
  }

  // 选择模型
  const selectModel = (modelId: string) => {
    setModel(modelId)
    setIsOpen(false)
  }

  return (
    <View className='model-selector'>
      {/* 选择器触发器 */}
      <View className='model-selector__trigger' onClick={toggleDropdown}>
        <Text className='model-selector__label'>模型</Text>
        <View className='model-selector__value'>
          <Text className='model-selector__current'>
            {getSelectedModelName(selectedModel)}
          </Text>
          <Text className={cn('model-selector__arrow', isOpen && 'model-selector__arrow--open')}>
            ▼
          </Text>
        </View>
      </View>

      {/* 下拉菜单 */}
      {isOpen && (
        <View className='model-selector__dropdown'>
          <View className='model-selector__list'>
            {MODEL_OPTIONS.map((model) => {
              const isSelected = model.id === selectedModel
              return (
                <View
                  key={model.id}
                  className={cn(
                    'model-selector__option',
                    isSelected && 'model-selector__option--selected'
                  )}
                  onClick={() => selectModel(model.id)}
                >
                  <Text className='model-selector__option-icon'>{model.icon}</Text>
                  <View className='model-selector__option-content'>
                    <Text className='model-selector__option-name'>{model.name}</Text>
                    <Text className='model-selector__option-desc'>{model.description}</Text>
                  </View>
                  {isSelected && (
                    <Text className='model-selector__check'>✓</Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      )}
    </View>
  )
}