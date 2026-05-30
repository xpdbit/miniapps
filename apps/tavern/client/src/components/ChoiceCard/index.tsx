import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'
import type { ChoiceOption } from '@/types/chat'
import './index.scss'

interface ChoiceCardProps {
  summary: string
  choices: ChoiceOption[]
  onSelect: (choice: ChoiceOption) => void
  onCustomInput: (text: string) => void
  disabled?: boolean
}

export default function ChoiceCard({ summary, choices, onSelect, onCustomInput, disabled }: ChoiceCardProps) {
  const [customText, setCustomText] = useState('')

  const handleCustomSubmit = () => {
    const trimmed = customText.trim()
    if (trimmed && !disabled) {
      onCustomInput(trimmed)
      setCustomText('')
    }
  }

  const handleSelect = (choice: ChoiceOption) => {
    if (!disabled) {
      onSelect(choice)
    }
  }

  return (
    <View className='choice-card'>
      <View className='choice-card-header'>
        <Text className='choice-card-summary-label'>📋 当前局面</Text>
        <Text className='choice-card-summary'>{summary}</Text>
      </View>

      <View className='choice-card-options'>
        {choices.map((choice, index) => (
          <View
            key={index}
            className={`choice-card-option ${disabled ? 'choice-card-option--disabled' : ''}`}
            onClick={() => handleSelect(choice)}
          >
            <Text className='choice-card-option-label'>{choice.label}</Text>
            <Text className='choice-card-option-desc'>{choice.description}</Text>
          </View>
        ))}
      </View>

      <View className='choice-card-custom'>
        <View className='choice-card-custom-divider'>
          <Text className='choice-card-custom-divider-text'>── 或自由行动 ──</Text>
        </View>
        <View className='choice-card-custom-input-row'>
          <Input
            className='choice-card-custom-input'
            value={customText}
            onInput={(e) => setCustomText(e.detail.value)}
            onConfirm={handleCustomSubmit}
            placeholder='输入你想做的任何事...'
            disabled={disabled}
            confirmType='send'
          />
        </View>
      </View>
    </View>
  )
}
