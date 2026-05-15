import { View, Text, Textarea, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'

import { characterService } from '@/services/characterService'
import type { CharacterCard } from '@/types/character'
import './index.scss'

const TAGS = ['萌娘', '科幻', '古风', '奇幻', '现实', '动物', '侦探', '冒险', '治愈']

interface CreatorForm {
  name: string
  description: string
  personality: string
  firstMsg: string
  scenario: string
  lore: string
  tags: string[]
  avatar: string
}

const emptyForm: CreatorForm = {
  name: '',
  description: '',
  personality: '',
  firstMsg: '',
  scenario: '',
  lore: '',
  tags: [],
  avatar: '',
}

export default function CreatorPage() {
  const router = useRouter()
  const { id } = router.params as { id?: string }
  const isEdit = !!id

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<CreatorForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      loadCharacter(id)
    }
  }, [id])

  const loadCharacter = async (characterId: string) => {
    try {
      Taro.showLoading({ title: '加载中' })
      const res = await characterService.detail(characterId)
      const c = res.data
      setForm({
        name: c.name || '',
        description: c.description || '',
        personality: c.personality || '',
        firstMsg: c.firstMsg || '',
        scenario: c.scenario || '',
        lore: c.lore || '',
        tags: c.tags || [],
        avatar: c.avatar || '',
      })
      Taro.hideLoading()
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }

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
      Taro.showToast({ title: '请输入角色名', icon: 'none' })
      return
    }
    if (!form.description.trim()) {
      Taro.showToast({ title: '请输入角色描述', icon: 'none' })
      return
    }
    if (!form.firstMsg.trim()) {
      Taro.showToast({ title: '请输入开场白', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const submitData: Partial<CharacterCard> = {
        name: form.name,
        description: form.description,
        personality: form.personality,
        firstMsg: form.firstMsg,
        scenario: form.scenario,
        lore: form.lore,
        tags: form.tags,
        avatar: form.avatar || undefined,
      }
      if (isEdit && id) {
        await characterService.update(id, submitData)
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        await characterService.create(submitData)
        Taro.showToast({ title: '创建成功', icon: 'success' })
      }
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    { title: '基本信息', icon: '1' },
    { title: '角色设定', icon: '2' },
    { title: '对话设定', icon: '3' },
    { title: '预览发布', icon: '4' },
  ]

  return (
    <View className='page-creator'>
      {/* Steps indicator */}
      <View className='page-creator-steps'>
        {steps.map((s, i) => (
          <View
            key={i}
            className={`page-creator-step ${step === i + 1 ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <View className='page-creator-step-num'>
              {i + 1 < step ? '✓' : s.icon}
            </View>
            <Text className='page-creator-step-label'>{s.title}</Text>
          </View>
        ))}
      </View>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <View className='page-creator-form'>
          <View className='page-creator-field'>
            <Text className='page-creator-label'>角色名 *</Text>
            <t-input
              className='page-creator-input'
              value={form.name}
              onInput={e => updateField('name', e.detail.value)}
              placeholder='给你的角色取个名字'
              maxlength={50}
            />
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>头像</Text>
            <View className='page-creator-avatar-selector'>
              <View className='page-creator-avatar-preview'>
                {form.avatar ? (
                  <Image src={form.avatar} mode='aspectFill' className='page-creator-avatar-img' />
                ) : (
                  <Text className='page-creator-avatar-placeholder'>{form.name?.[0] || '?'}</Text>
                )}
              </View>
              <Text className='page-creator-avatar-hint'>点击选择头像（开发中）</Text>
            </View>
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>标签（可选，最多10个）</Text>
            <View className='page-creator-tags'>
              {TAGS.map(tag => (
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

          <t-button className='page-creator-next-btn' onClick={() => setStep(2)}>
            下一步
          </t-button>
        </View>
      )}

      {/* Step 2: Character setting */}
      {step === 2 && (
        <View className='page-creator-form'>
          <View className='page-creator-field'>
            <Text className='page-creator-label'>角色描述 *</Text>
            <Textarea
              className='page-creator-textarea'
              value={form.description}
              onInput={e => updateField('description', e.detail.value)}
              placeholder='描述角色的外貌、性格、身份...'
              maxlength={2000}
            />
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>人格特征</Text>
            <t-input
              className='page-creator-input'
              value={form.personality}
              onInput={e => updateField('personality', e.detail.value)}
              placeholder='如：开朗、神秘、傲娇...'
              maxlength={500}
            />
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>场景设定</Text>
            <Textarea
              className='page-creator-textarea'
              value={form.scenario}
              onInput={e => updateField('scenario', e.detail.value)}
              placeholder='故事发生的场景...'
              maxlength={1000}
            />
          </View>

          <View className='page-creator-nav'>
            <t-button className='page-creator-prev-btn' onClick={() => setStep(1)}>上一步</t-button>
            <t-button className='page-creator-next-btn' onClick={() => setStep(3)}>下一步</t-button>
          </View>
        </View>
      )}

      {/* Step 3: Dialogue */}
      {step === 3 && (
        <View className='page-creator-form'>
          <View className='page-creator-field'>
            <Text className='page-creator-label'>开场白 *</Text>
            <Textarea
              className='page-creator-textarea'
              value={form.firstMsg}
              onInput={e => updateField('firstMsg', e.detail.value)}
              placeholder='角色对玩家说的第一句话...'
              maxlength={500}
            />
            <Text className='page-creator-hint'>这是用户开始对话时角色说的第一句话</Text>
          </View>

          <View className='page-creator-field'>
            <Text className='page-creator-label'>世界观 / 背景知识</Text>
            <Textarea
              className='page-creator-textarea page-creator-textarea--large'
              value={form.lore}
              onInput={e => updateField('lore', e.detail.value)}
              placeholder='角色的背景故事、世界观设定...'
              maxlength={5000}
            />
          </View>

          <View className='page-creator-nav'>
            <t-button className='page-creator-prev-btn' onClick={() => setStep(2)}>上一步</t-button>
            <t-button className='page-creator-next-btn' onClick={() => setStep(4)}>下一步</t-button>
          </View>
        </View>
      )}

      {/* Step 4: Preview & Publish */}
      {step === 4 && (
        <View className='page-creator-form'>
          <View className='page-creator-preview-card'>
            <Text className='page-creator-preview-name'>{form.name || '(未命名角色)'}</Text>
            <Text className='page-creator-preview-desc'>{form.description || '暂无描述'}</Text>
            <View className='page-creator-preview-tags'>
              {form.tags.map(t => (
                <Text key={t} className='page-creator-preview-tag'>{t}</Text>
              ))}
            </View>
            <View className='page-creator-preview-first'>
              <Text className='page-creator-preview-first-label'>开场白：</Text>
              <Text className='page-creator-preview-first-text'>{form.firstMsg || '暂未设置'}</Text>
            </View>
          </View>

          <View className='page-creator-nav'>
            <t-button className='page-creator-prev-btn' onClick={() => setStep(3)}>上一步</t-button>
            <t-button
              className='page-creator-submit-btn'
              onClick={handleSubmit}
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? '保存中...' : isEdit ? '保存修改' : '创建角色'}
            </t-button>
          </View>
        </View>
      )}
    </View>
  )
}