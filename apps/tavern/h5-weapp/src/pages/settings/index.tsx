import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'

import { useAuthStore } from '@/stores/authStore'
import { httpClient } from '@/services/httpClient'
import './index.scss'

interface ApiKey {
  id: string
  provider: string
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
  data: { id: string; provider: string; isActive: boolean; createdAt: string }
  message: string
}

const PROVIDERS = [
  { key: 'openai', name: 'OpenAI', icon: 'AI' },
  { key: 'deepseek', name: 'DeepSeek', icon: 'DS' },
  { key: 'openrouter', name: 'OpenRouter', icon: 'OR' },
] as const

export default function SettingsPage() {
  const { user, refreshQuota } = useAuthStore()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [keyValue, setKeyValue] = useState('')
  const [, setVerifying] = useState(false)
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
    refreshQuota()
    loadKeys()
  })

  const getKeyByProvider = useCallback(
    (provider: string) => keys.find(k => k.provider === provider),
    [keys],
  )

  const maskKey = useCallback((key: string) => {
    if (key.length <= 8) return '****'
    return `${key.slice(0, 4)}****${key.slice(-4)}`
  }, [])

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
      })
      if (res.code === 0) {
        Taro.showToast({ title: '添加成功', icon: 'success' })
        setShowModal(false)
        setKeyValue('')
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

  const handleDeleteKey = useCallback(
    async (id: string) => {
      const existKey = keys.find(k => k.id === id)
      if (!existKey) return
      const providerName = PROVIDERS.find(p => p.key === existKey.provider)?.name || existKey.provider
      try {
        await Taro.showModal({
          title: '确认删除',
          content: `确定要删除 ${providerName} API Key 吗？`,
        })
      } catch {
        return
      }
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
    },
    [keys, loadKeys],
  )

  const remaining = (user?.dailyQuota ?? 20) - (user?.usedQuota ?? 0)

  return (
    <View className='page-settings'>
      {/* 配额信息 */}
      <View className='page-settings-section'>
        <Text className='page-settings-section-title'>今日配额</Text>
        <View className='page-settings-quota'>
          <View className='page-settings-quota-item'>
            <Text className='page-settings-quota-label'>剩余次数</Text>
            <Text className='page-settings-quota-value page-settings-quota-value--highlight'>
              {remaining}
            </Text>
          </View>
          <View className='page-settings-quota-divider' />
          <View className='page-settings-quota-item'>
            <Text className='page-settings-quota-label'>总次数</Text>
            <Text className='page-settings-quota-value'>{user?.dailyQuota ?? 20}</Text>
          </View>
        </View>
      </View>

      {/* API Key 管理 */}
      <View className='page-settings-section'>
        <Text className='page-settings-section-title'>API Key 管理</Text>
        <View className='page-settings-keys'>
          {PROVIDERS.map(provider => {
            const existKey = getKeyByProvider(provider.key)
            return (
              <View key={provider.key} className='page-settings-key-item'>
                <View className='page-settings-key-info'>
                  <Text className='page-settings-key-icon'>{provider.icon}</Text>
                  <View className='page-settings-key-detail'>
                    <Text className='page-settings-key-name'>{provider.name}</Text>
                    {existKey ? (
                      <Text className='page-settings-key-masked'>{maskKey(existKey.id)}</Text>
                    ) : (
                      <Text className='page-settings-key-unconfigured'>未配置</Text>
                    )}
                  </View>
                </View>
                <View className='page-settings-key-actions'>
                  {existKey ? (
                    <>
                      <Text className='page-settings-key-status page-settings-key-status--ok'>✓ 已配置</Text>
                      <Text
                        className='page-settings-key-delete'
                        onClick={() => handleDeleteKey(existKey.id)}
                      >
                        {deletingId === existKey.id ? '删除中...' : '删除'}
                      </Text>
                    </>
                  ) : (
                    <Text
                      className='page-settings-key-add'
                      onClick={() => {
                        setSelectedProvider(provider.key)
                        setShowModal(true)
                      }}
                    >
                      添加
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 添加 Key 弹窗 — 使用 TDesign t-dialog */}
      <t-dialog
        visible={showModal}
        title='添加 API Key'
        confirmBtn='添加并验证'
        cancelBtn='取消'
        onClose={() => setShowModal(false)}
        onConfirm={handleAddKey}
      >
        <View className='page-settings-modal-form'>
          <View className='page-settings-modal-field'>
            <Text className='page-settings-modal-label'>服务商</Text>
            <View className='page-settings-modal-provider'>
              {PROVIDERS.map(p => (
                <Text
                  key={p.key}
                  className={`page-settings-modal-provider-option ${selectedProvider === p.key ? 'active' : ''}`}
                  onClick={() => setSelectedProvider(p.key)}
                >
                  {p.icon} {p.name}
                </Text>
              ))}
            </View>
          </View>
          <View className='page-settings-modal-field'>
            <Text className='page-settings-modal-label'>API Key</Text>
            <t-input
              className='page-settings-modal-input'
              type='text'
              password
              placeholder='sk-...'
              value={keyValue}
              onChange={e => setKeyValue(e.detail.value)}
            />
          </View>
        </View>
        <View className='page-settings-modal-hint'>
          <Text>输入你的 API Key，系统会自动验证有效性</Text>
        </View>
      </t-dialog>
    </View>
  )
}