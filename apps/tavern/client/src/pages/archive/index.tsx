import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import './index.scss'

export default function ArchivePage() {
  const { saves, restoreSaves, setActiveSave, deleteSave } = useGameStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useDidShow(() => {
    restoreSaves()
  })

  const handleSelectSave = (id: string) => {
    setActiveSave(id)
    Taro.switchTab({ url: '/pages/chat/index' })
  }

  const handleDelete = async (id: string, e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const modalRes = await Taro.showModal({ title: '确认删除', content: '删除后不可恢复' })
    if (!modalRes.confirm) return
    setDeletingId(id)
    deleteSave(id)
    setDeletingId(null)
  }

  const handleNewGame = () => {
    Taro.navigateTo({ url: '/pages/game-setup/index' })
  }

  return (
    <View className='page-archive'>
      <View className='page-archive-header'>
        <Text className='page-archive-header-title'>选择存档</Text>
      </View>

      <ScrollView className='page-archive-list' scrollY>
        {saves.map(save => (
          <View
            key={save.id}
            className='page-archive-item'
            onClick={() => handleSelectSave(save.id)}
          >
            <View className='page-archive-item-icon'>
              <Text className='page-archive-item-icon-text'>🎮</Text>
            </View>
            <View className='page-archive-item-info'>
              <Text className='page-archive-item-name'>{save.name}</Text>
              <Text className='page-archive-item-meta'>
                {save.playerCount} 人 · {new Date(save.updatedAt).toLocaleDateString('zh-CN')}
              </Text>
            </View>
            <Text
              className='page-archive-item-delete'
              onClick={(e) => handleDelete(save.id, e)}
            >
              {deletingId === save.id ? '删除中...' : '删除'}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className='page-archive-footer'>
        <View className='page-archive-new-btn' onClick={handleNewGame}>
          <Text className='page-archive-new-btn-icon'>+</Text>
          <Text>开始新游戏</Text>
        </View>
      </View>
    </View>
  )
}