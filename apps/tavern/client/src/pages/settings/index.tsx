import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'

import { useAuthStore } from '@/stores/authStore'
import { httpClient } from '@/services/httpClient'
import { Icon } from '@/components'
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
  { key: 'opencode', name: 'OpenCode Go', icon: 'OC', free: true, desc: '免费AI · Big Pickle / MiniMax M2.5' },
  { key: 'openai', name: 'OpenAI', icon: 'OA', free: false, desc: 'GPT-4o / GPT-4 Turbo' },
  { key: 'anthropic', name: 'Anthropic', icon: 'AN', free: false, desc: 'Claude 3.5 Sonnet / Opus' },
  { key: 'google', name: 'Google', icon: 'GG', free: false, desc: 'Gemini 2.5 Pro / Flash' },
  { key: 'zhipu', name: '智谱AI', icon: 'ZP', free: false, desc: 'GLM-4 / ChatGLM' },
  { key: 'deepseek', name: 'DeepSeek', icon: 'DS', free: false, desc: 'DeepSeek-V3 / R1' },
  { key: 'moonshot', name: '月之暗面', icon: 'MS', free: false, desc: 'Kimi / Moonshot-v1' },
  { key: 'minimax', name: 'MiniMax', icon: 'MM', free: false, desc: 'abab6.5s / abab7' },
] as const

export default function SettingsPage() {
  const { user, refreshQuota } = useAuthStore()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [keyValue, setKeyValue] = useState('')
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
    refreshQuota()
    loadKeys()
  })

  const getKeyByProvider = useCallback(
    (provider: string) => keys.find(k => k.provider === provider),
    [keys],
  )

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
                    <View className='page-settings-key-header-row'>
                      <Text className='page-settings-key-name'>{provider.name}</Text>
                      {provider.free && (
                        <Text className='page-settings-key-badge page-settings-key-badge--free'>免费</Text>
                      )}
                    </View>
                    <Text className='page-settings-key-desc'>{provider.desc}</Text>
                    {existKey ? (
                      <Text className='page-settings-key-masked'>
                        {existKey.createdAt ? `配置于 ${new Date(existKey.createdAt).toLocaleDateString('zh-CN')}` : '已配置'}
                      </Text>
                    ) : (
                      <Text className='page-settings-key-unconfigured'>{provider.free ? '默认可用' : '未配置'}</Text>
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
                      {provider.free ? '启用' : '添加'}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 添加 Key 弹窗 */}
      {showModal && (
              <View className='page-settings-modal-overlay' onClick={() => setShowModal(false)}>
                <View className='page-settings-modal' onClick={(e) => e.stopPropagation()}>
                  <View className='page-settings-modal-header'>
                    <Text className='page-settings-modal-title'>添加 API Key</Text>
                    <Text className='page-settings-modal-close' onClick={() => setShowModal(false)}>
                      <Icon name='close' size={32} color='#999' />
                    </Text>
                  </View>
                  <View className='page-settings-modal-body'>
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
                        <Input
                          className='page-settings-modal-input'
                          type='text'
                          password
                          placeholder='sk-...'
                          value={keyValue}
                          onInput={e => setKeyValue(e.detail.value)}
                        />
                      </View>
                    </View>
                    <View className='page-settings-modal-hint'>
                      <Text>输入你的 API Key，系统会自动验证有效性</Text>
                    </View>
                  </View>
                  <View className='page-settings-modal-footer'>
                    <Button className='page-settings-modal-cancel-btn' onClick={() => setShowModal(false)}>取消</Button>
                    <Button
                      className='page-settings-modal-confirm-btn'
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