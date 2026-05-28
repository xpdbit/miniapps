import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useGameStore } from '@/stores/gameStore'
import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import CustomTabBar from '@/custom-tab-bar'
import { Icon, EmptyState } from '@/components'
import './index.scss'

export default function ContactsPage() {
  const { activeSave, restoreSaves } = useGameStore()
  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const save = activeSave()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 1)
    restoreSaves()
  })

  const characterIds = save?.selectedCards?.characters || []
  const allCards = [...syncedStore.cards, ...localStore.cards]
  const characters = characterIds
    .map(id => allCards.find(c => c.id === id))
    .filter(Boolean)

  if (!save) {
    return (
      <View className='page-contacts'>
        <View className='page-contacts-header'>
          <Text className='page-contacts-header-title'>通讯录</Text>
        </View>
        <View className='page-contacts-empty'>
          <EmptyState
            icon={<Icon name='persona' size={64} color='var(--color-icon-disabled)' />}
            title='暂无联系人'
            description='开启游戏模式，选择角色卡开始冒险后，联系人将自动出现。'
          />
        </View>
        <CustomTabBar />
      </View>
    )
  }

  return (
    <View className='page-contacts'>
        <View className='page-contacts-header'>
          <Text className='page-contacts-header-title'>通讯录</Text>
        </View>
        <ScrollView scrollY className='page-contacts-list'>
          {characters.map((char, idx) => (
            <View
              key={char?.id || idx}
              className='page-contacts-item'
              onClick={() => {
                if (char?.id) {
                  Taro.navigateTo({ url: `/pages/character/detail/index?id=${char.id}&mode=chat` })
                }
              }}
            >
              <View className='page-contacts-item-avatar'>
                {char?.avatar ? (
                  <Image src={char.avatar} className='page-contacts-item-avatar-img' />
                ) : (
                  <Text className='page-contacts-item-avatar-text'>{(char?.name || '?')[0]}</Text>
                )}
              </View>
              <View className='page-contacts-item-info'>
                <Text className='page-contacts-item-name'>{char?.name || '未知角色'}</Text>
                <Text className='page-contacts-item-desc'>
                  {char?.description?.slice(0, 40) || ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <CustomTabBar />
      </View>
  )
}
