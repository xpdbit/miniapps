import { View, Text, ScrollView, Textarea, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'

import { personaService, type Persona } from '@/services/personaService'
import { useAuthStore } from '@/stores/authStore'
import { EmptyState, Icon } from '@/components'
import './index.scss'

interface PersonaForm {
  name: string
  description: string
}

const emptyForm: PersonaForm = { name: '', description: '' }

export default function PersonaPage() {
  const { isLoggedIn } = useAuthStore()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PersonaForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [, setDeleteId] = useState<string | null>(null)

  const loadPersonas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await personaService.list()
      setPersonas(res.data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    if (isLoggedIn) loadPersonas()
  })

  const openCreateModal = () => {
    setEditId(null)
    setForm(emptyForm)
    setModalVisible(true)
  }

  const openEditModal = (persona: Persona) => {
    setEditId(persona.id)
    setForm({ name: persona.name, description: persona.description || '' })
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setEditId(null)
    setForm(emptyForm)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请输入角色名', icon: 'none' })
      return
    }
    if (form.name.length > 50) {
      Taro.showToast({ title: '角色名最多50字', icon: 'none' })
      return
    }
    if (form.description.length > 500) {
      Taro.showToast({ title: '描述最多500字', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      if (editId) {
        await personaService.update(editId, {
          name: form.name,
          description: form.description || undefined,
        })
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        await personaService.create({
          name: form.name,
          description: form.description || undefined,
        })
        Taro.showToast({ title: '创建成功', icon: 'success' })
      }
      closeModal()
      loadPersonas()
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await personaService.setDefault(id)
      Taro.showToast({ title: '已设为默认', icon: 'success' })
      loadPersonas()
    } catch {
      Taro.showToast({ title: '设置失败', icon: 'none' })
    }
  }

  const confirmDelete = (id: string) => {
    setDeleteId(id)
    Taro.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      confirmColor: '#F87171',
      success: async (res) => {
        if (res.confirm) {
          try {
            await personaService.delete(id)
            Taro.showToast({ title: '已删除', icon: 'success' })
            loadPersonas()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
        setDeleteId(null)
      },
    })
  }

  return (
    <View className='page-persona'>
      <ScrollView scrollY className='page-persona-content'>
        {loading ? (
          <View className='page-persona-loading'>
            <Text>加载中...</Text>
          </View>
        ) : personas.length === 0 ? (
          <View className='page-persona-empty'>
            <EmptyState
              icon={<Icon name='persona' size={64} color='#CCCCCC' />}
              title='还没有角色'
              description='创建一个角色来开启对话'
            />
          </View>
        ) : (
          personas.map(persona => (
            <View key={persona.id} className='page-persona-item'>
              <View className='page-persona-item-avatar'>
                {persona.avatar ? (
                  <Image src={persona.avatar} mode='aspectFill' className='page-persona-item-avatar-img' />
                ) : (
                  <Text className='page-persona-item-avatar-text'>{persona.name?.[0] || '?'}</Text>
                )}
              </View>
              <View className='page-persona-item-info'>
                <View className='page-persona-item-header'>
                  <Text className='page-persona-item-name'>{persona.name}</Text>
                  {persona.isDefault && (
                    <Text className='page-persona-item-badge'>默认</Text>
                  )}
                </View>
                {persona.description && (
                  <Text className='page-persona-item-desc' numberOfLines={2}>
                    {persona.description}
                  </Text>
                )}
              </View>
              <View className='page-persona-item-actions'>
                <Text
                  className={`page-persona-item-action ${persona.isDefault ? 'disabled' : ''}`}
                  onClick={() => !persona.isDefault && handleSetDefault(persona.id)}
                >
                  设为默认
                </Text>
                <Text
                  className='page-persona-item-action'
                  onClick={() => openEditModal(persona)}
                >
                  编辑
                </Text>
                <Text
                  className='page-persona-item-action delete'
                  onClick={() => confirmDelete(persona.id)}
                >
                  删除
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View className='page-persona-footer'>
        <Button className='page-persona-create-btn' onClick={openCreateModal}>
          创建新角色
        </Button>
      </View>

      {/* Modal */}
      {modalVisible && (
        <View className='page-persona-modal-overlay' onClick={closeModal}>
          <View className='page-persona-modal' onClick={(e) => e.stopPropagation()}>
            <View className='page-persona-modal-header'>
              <Text className='page-persona-modal-title'>{editId ? '编辑角色' : '创建角色'}</Text>
              <Text className='page-persona-modal-close' onClick={closeModal}>
                <Icon name='close' size={32} color='#999' />
              </Text>
            </View>
            <View className='page-persona-modal-body'>
              <View className='page-persona-modal-field'>
                <Text className='page-persona-modal-label'>角色名 *</Text>
                <Input
                  className='page-persona-modal-input'
                  value={form.name}
                  onInput={e => setForm(prev => ({ ...prev, name: e.detail.value }))}
                  placeholder='输入角色名'
                  maxlength={50}
                />
              </View>
              <View className='page-persona-modal-field'>
                <Text className='page-persona-modal-label'>描述（可选）</Text>
                <Textarea
                  className='page-persona-modal-textarea'
                  value={form.description}
                  onInput={e => setForm(prev => ({ ...prev, description: e.detail.value }))}
                  placeholder='输入角色描述'
                  maxlength={500}
                />
              </View>
            </View>
            <View className='page-persona-modal-footer'>
              <Button className='page-persona-modal-cancel-btn' onClick={closeModal}>取消</Button>
              <Button className='page-persona-modal-confirm-btn' onClick={handleSubmit} disabled={submitting}>
                {submitting ? '保存中...' : '保存'}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}