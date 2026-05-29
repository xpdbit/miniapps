import { View, Text, Textarea, Input, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Icon } from '@/components'
import type { IconName } from '@/components/Icon'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useAuthStore } from '@/stores/authStore'
import { characterService } from '@/services/characterService'
import type { CardType } from '@/types/character'
import { CARD_TYPE_LABELS } from '@/types/character'
import './index.scss'

const TAGS: Record<CardType, string[]> = {
  CHARACTER: ['萌娘', '科幻', '古风', '奇幻', '现实', '动物', '侦探', '冒险', '治愈'],
  MECHANISM: ['战斗', '探索', '养成', '策略', '社交', '经济', '解谜', '竞技'],
  MAP: ['城镇', '森林', '沙漠', '海洋', '天空', '地下城', '遗迹', '异世界'],
  BACKGROUND: ['奇幻', '科幻', '历史', '现代', '末世', '校园', '武侠', '神话'],
}

const TYPE_ICONS: Record<CardType, IconName> = {
  CHARACTER: 'user',
  MECHANISM: 'settings',
  MAP: 'gallery',
  BACKGROUND: 'photo',
}

interface CreatorForm {
  name: string
  description: string
  prompt: string
  tags: string[]
  cardType: CardType
}

function emptyForm(cardType: CardType): CreatorForm {
  return {
    name: '',
    description: '',
    prompt: '',
    tags: [],
    cardType,
  }
}

export default function CreatorPage() {
  const router = useRouter()
  const params = router.params as { cardType?: CardType; edit?: string }
  const cardType: CardType = params.cardType && ['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND'].includes(params.cardType)
    ? params.cardType as CardType
    : 'CHARACTER'
  const editId = params.edit || null

  const localStore = useLocalCardsStore()
  const authStore = useAuthStore()
  const isEdit = !!editId

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<CreatorForm>(emptyForm(cardType))
  const [submitting, setSubmitting] = useState(false)

  // 加载本地卡片（编辑模式）
  useEffect(() => {
    if (editId) {
      const card = localStore.getCardById(editId)
      if (card) {
        setForm({
          name: card.name || '',
          description: card.description || '',
          prompt: card.prompt || '',
          tags: card.tags || [],
          cardType: card.cardType || cardType,
        })
      }
    }
  }, [editId])

  const updateField = <K extends keyof CreatorForm>(field: K, value: CreatorForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleTag = (tag: string) => {
    const tags = form.tags.includes(tag)
      ? form.tags.filter(t => t !== tag)
      : [...form.tags, tag]
    updateField('tags', tags)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请输入卡片名称', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const cardData = {
        name: form.name,
        description: form.description,
        cardType: form.cardType,
        prompt: form.prompt,
        tags: form.tags,
      }

      if (authStore.isLoggedIn) {
        // 服务器端保存
        let res: { code: number; message?: string; data?: unknown }
        if (isEdit && editId) {
          res = await characterService.update(editId, cardData)
        } else {
          res = await characterService.create(cardData)
        }
        if (res.code === 0) {
          Taro.showToast({ title: isEdit ? '保存成功' : '创建成功', icon: 'success' })
        } else {
          throw new Error(res.message || '保存失败')
        }
      } else {
        // 未登录 — 降级到本地存储
        if (isEdit && editId) {
          localStore.updateCard(editId, cardData)
        } else {
          localStore.createCard(cardData)
        }
        Taro.showToast({ title: '未登录，卡片已保存至本地', icon: 'none' })
      }
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = () => {
    if (!editId) return
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这张卡片吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (authStore.isLoggedIn) {
              await characterService.delete(editId)
            }
          } catch {
            // API 删除失败也继续本地删除
          }
          localStore.deleteCard(editId)
          Taro.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1500)
        }
      },
    })
  }

  const steps = [
    { title: '基本信息', icon: '1' },
    { title: '详细设定', icon: '2' },
    { title: '预览发布', icon: '3' },
  ]

  return (
    <View className='page-creator'>
      <View className='page-creator-header'>
        <View className='page-creator-back' onClick={() => Taro.navigateBack()}>
          <Icon name='arrow-left' size={36} color='var(--color-icon-muted)' />
        </View>
        <Text className='page-creator-header-title'>
          {isEdit ? '编辑' : '创建'}{CARD_TYPE_LABELS[form.cardType]}卡
        </Text>
      </View>

      {/* Steps indicator */}
      <View className='page-creator-steps'>
        {steps.map((s, i) => (
          <View
            key={i}
            className={`page-creator-step ${step === i + 1 ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <View className='page-creator-step-num'>
              {i + 1 < step ? <Icon name='checkin-done' size={24} color='#2EC4B6' /> : s.icon}
            </View>
            <Text className='page-creator-step-label'>{s.title}</Text>
          </View>
        ))}
      </View>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <View className='page-creator-form'>
          <View className='page-creator-field'>
            <Text className='page-creator-label'>卡片名称 *</Text>
            <Input
              className='page-creator-input'
              value={form.name}
              onInput={e => updateField('name', e.detail.value)}
              placeholder={`给你的${CARD_TYPE_LABELS[form.cardType]}卡取个名字`}
              maxlength={50}
            />
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>卡片类型</Text>
            <View className='page-creator-card-type-selector'>
              {(['CHARACTER', 'MECHANISM', 'MAP', 'BACKGROUND'] as CardType[]).map(type => (
                <View
                  key={type}
                  className={`page-creator-card-type-option ${form.cardType === type ? 'active' : ''}`}
                  onClick={() => updateField('cardType', type)}
                >
                  <Icon
                    name={type === 'CHARACTER' ? 'user' : type === 'MECHANISM' ? 'settings' : type === 'MAP' ? 'gallery' : 'photo'}
                    size={24}
                    color={form.cardType === type ? '#007AFF' : '#999'}
                  />
                  <Text>{CARD_TYPE_LABELS[type]}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>标签（可选）</Text>
            <View className='page-creator-tags'>
              {(TAGS[form.cardType] || []).map(tag => (
                <Text
                  key={tag}
                  className={`page-creator-tag ${form.tags.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Text>
              ))}
            </View>
          </View>

          <Button className='page-creator-next-btn' onClick={() => setStep(2)}>
            下一步
          </Button>
        </View>
      )}

      {/* Step 2: Detailed setting */}
      {step === 2 && (
        <View className='page-creator-form'>
          <View className='page-creator-field'>
            <Text className='page-creator-label'>卡片描述 *</Text>
            <Textarea
              className='page-creator-textarea'
              value={form.description}
              onInput={e => updateField('description', e.detail.value)}
              placeholder={`描述这张${CARD_TYPE_LABELS[form.cardType]}卡的详细内容...`}
              maxlength={2000}
            />
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>提示词</Text>
            <Textarea
              className='page-creator-textarea page-creator-textarea--large'
              value={form.prompt}
              onInput={e => updateField('prompt', e.detail.value)}
              placeholder='定义 AI 角色的行为逻辑、性格特征、背景知识和对话风格...'
              maxlength={5000}
            />
          </View>

          <View className='page-creator-nav'>
            <Button className='page-creator-prev-btn' onClick={() => setStep(1)}>上一步</Button>
            <Button className='page-creator-next-btn' onClick={() => setStep(3)}>下一步</Button>
          </View>
        </View>
      )}

      {/* Step 3: Preview & Publish */}
      {step === 3 && (
        <View className='page-creator-form'>
          <View className='page-creator-preview-card'>
            <View className='page-creator-preview-type'>
              <Icon
                name={TYPE_ICONS[form.cardType]}
                size={36} color='var(--color-icon-action)'
              />
              <Text>{CARD_TYPE_LABELS[form.cardType]}卡</Text>
            </View>
            <Text className='page-creator-preview-name'>{form.name || '(未命名)'}</Text>
            <Text className='page-creator-preview-desc'>{form.description || '暂无描述'}</Text>
            <View className='page-creator-preview-tags'>
              {form.tags.map(t => (
                <Text key={t} className='page-creator-preview-tag'>{t}</Text>
              ))}
            </View>

          </View>

          <View className='page-creator-nav'>
            <Button className='page-creator-prev-btn' onClick={() => setStep(2)}>上一步</Button>
            <Button
              className='page-creator-submit-btn'
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '保存中...' : isEdit ? '保存修改' : '创建卡片'}
            </Button>
          </View>
          {isEdit && (
            <Button className='page-creator-delete-btn' onClick={handleDelete}>
              删除卡片
            </Button>
          )}
        </View>
      )}
    </View>
  )
}
