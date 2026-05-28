import { View, Text, ScrollView, Image, Button, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'

import { marketService } from '@/services/marketService'
import { Icon, ModelSelector } from '@/components'
import ChatBubble from '@/components/ChatBubble'
import { useChatStore } from '@/stores/chatStore'
import { usePrivacyStore } from '@/stores/privacyStore'
import { useSSE } from '@/hooks/useSSE'
import { useDirectAI, loadLocalMessages } from '@/hooks/useDirectAI'
import { useAuthStore } from '@/stores/authStore'
import { formatCount } from '@/utils'
import type { CharacterCard } from '@/types/character'
import './index.scss'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审核中',
  PUBLISHED: '已发布',
  BANNED: '已封禁',
}

type ViewMode = 'detail' | 'chat'

export default function CharacterDetailPage() {
  const router = useRouter()
  const { id, mode } = router.params as { id?: string; mode?: string }

  const [character, setCharacter] = useState<CharacterCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [view, setView] = useState<ViewMode>(mode === 'chat' ? 'chat' : 'detail')
  const [input, setInput] = useState('')
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // 是否从通讯录直接进入聊天模式（WeChat 风格）
  const directChat = mode === 'chat'

  const { selectedModel, selectedProvider } = useChatStore()
  const { privacyMode, getLocalKey } = usePrivacyStore()

  const sse = useSSE({
    onError: (code, message) => {
      const tips: Record<string, string> = {
        NOT_LOGGED_IN: '请先登录后再对话',
        QUOTA_EXCEEDED: '今日免费额度已用完',
        KEY_MISSING: '未配置 API Key',
      }
      Taro.showToast({ title: tips[code] || message || '对话失败', icon: 'none' })
    },
  })

  const directAI = useDirectAI({
    onError: (code, message) => {
      const tips: Record<string, string> = {
        KEY_MISSING: '隐私模式下需要配置 API Key，请在"我的"页面添加',
        NETWORK_ERROR: '网络连接失败，请检查 API Key 和服务商配置',
      }
      Taro.showToast({ title: tips[code] || message || '对话失败', icon: 'none' })
    },
  })

  // 隐私模式下使用直连，否则使用服务端 SSE 中转
  const activeChat = privacyMode ? directAI : sse

  const loadCharacter = useCallback(async () => {
    if (!id) {
      setError(true)
      setLoading(false)
      return
    }
    try {
      const res = await marketService.detail(id) as { data: CharacterCard }
      if (res.data) {
        setCharacter(res.data)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadCharacter()
  }, [loadCharacter])

  // 通讯录直聊模式：角色加载完成后自动显示开场白或恢复对话历史
  useEffect(() => {
    if (directChat && character && view === 'chat' && activeChat.messages.length === 0) {
      if (privacyMode) {
        // 优先恢复历史对话，无历史才显示开场白
        const existingHistory = loadLocalMessages(character.id)
        if (existingHistory.length > 0) {
          directAI.loadHistory(character.id)
        } else {
          directAI.addCharacterMessage('你好')
        }
      } else {
        sse.addCharacterMessage('你好')
      }
    }
  }, [directChat, character, view, activeChat.messages.length, privacyMode])

  const handleStartChat = () => {
    if (!character) return

    if (!privacyMode) {
      // 非隐私模式：需要登录走服务端 SSE 中转
      const token = useAuthStore.getState().token
      if (!token) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }
    } else {
      // 隐私模式：需要本地 API Key
      const localKey = getLocalKey(selectedProvider)
      if (!localKey?.keyValue) {
        Taro.showModal({
          title: '需要 API Key',
          content: `隐私模式下需要配置 ${selectedProvider} 的 API Key。\n\n请在"我的"页面添加 API Key 后重试。`,
          confirmText: '去配置',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              Taro.switchTab({ url: '/pages/profile/index' })
            }
          },
        })
        return
      }
    }

    setView('chat')

    // 隐私模式：优先恢复历史对话，无历史才显示开场白
    const greeting = '你好'
    if (privacyMode && character) {
      const existingHistory = loadLocalMessages(character.id)
      if (existingHistory.length > 0) {
        directAI.loadHistory(character.id)
        // 已有历史对话，不追加开场白 — 延迟发送用户消息以确保历史加载完成
        const localKey = getLocalKey(selectedProvider)
        if (!localKey) return
        setTimeout(() => {
          directAI.sendMessage({
            characterId: character.id,
            message: '你好',
            apiKey: localKey.keyValue,
            baseUrl: localKey.baseUrl,
            provider: selectedProvider,
            model: selectedModel,
            cardData: {
              name: character.name,
              description: character.description,
              prompt: character.prompt,
            },
          })
        }, 50)
        return
      }
      // 无历史：添加开场白，然后发送用户消息
      directAI.addCharacterMessage(greeting)
    } else {
      sse.addCharacterMessage(greeting)
    }

    // 发送首条用户消息触发 AI 对话
    if (privacyMode) {
      const localKey = getLocalKey(selectedProvider)
      if (!localKey) return
      directAI.sendMessage({
        characterId: character.id,
        message: '你好',
        apiKey: localKey.keyValue,
        baseUrl: localKey.baseUrl,
        provider: selectedProvider,
        model: selectedModel,
        cardData: {
          name: character.name,
          description: character.description,
          prompt: character.prompt,
        },
      })
    } else {
      sse.sendMessage({
        characterId: character.id,
        message: '你好',
        model: selectedModel,
        provider: selectedProvider,
        cardData: {
          name: character.name,
          description: character.description,
          prompt: character.prompt,
        },
      })
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || !character || activeChat.isStreaming) return
    setInput('')

    if (privacyMode) {
      const localKey = getLocalKey(selectedProvider)
      if (!localKey?.keyValue) {
        Taro.showModal({
          title: '缺少 API Key',
          content: `隐私模式下需要配置 ${selectedProvider} 的 API Key 才能发送消息。\n\n是否前往"我的"页面配置？`,
          confirmText: '去配置',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              Taro.switchTab({ url: '/pages/profile/index' })
            }
          },
        })
        return
      }
      directAI.sendMessage({
        characterId: character.id,
        message: text,
        apiKey: localKey.keyValue,
        baseUrl: localKey.baseUrl,
        provider: selectedProvider,
        model: selectedModel,
        cardData: {
          name: character.name,
          description: character.description,
          prompt: character.prompt,
        },
      })
    } else {
      sse.sendMessage({
        characterId: character.id,
        message: text,
        model: selectedModel,
        provider: selectedProvider,
      })
    }
  }

  const handleBackToDetail = () => {
    activeChat.clearMessages()
    setView('detail')
  }

  /** 重新生成最后一条 AI 回复 */
  const handleRegenerate = () => {
    if (!character) return
    const msgs = activeChat.messages
    if (msgs.length < 2) return

    // 找到最后一条用户消息
    let lastUserIdx = -1
    let lastAiIdx = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m && m.role === 'character' && lastAiIdx === -1) {
        lastAiIdx = i
      } else if (m && m.role === 'user' && lastAiIdx !== -1) {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx === -1 || lastAiIdx === -1) return

    // 获取用户消息内容并移除最后一条 AI 回复
    const userMsg = msgs[lastUserIdx]
    if (!userMsg) return
    activeChat.removeLastAiMessage()

    // 重新发送
    if (privacyMode) {
      const localKey = getLocalKey(selectedProvider)
      if (!localKey?.keyValue) return
      directAI.sendMessage({
        characterId: character.id,
        message: userMsg.content,
        apiKey: localKey.keyValue,
        baseUrl: localKey.baseUrl,
        provider: selectedProvider,
        model: selectedModel,
        cardData: {
          name: character.name,
          description: character.description,
          prompt: character.prompt,
        },
      })
    } else {
      sse.sendMessage({
        characterId: character.id,
        message: userMsg.content,
        model: selectedModel,
        provider: selectedProvider,
      })
    }
  }

  /** 长按消息：编辑/删除 */
  const handleLongPress = (index: number) => {
    const msg = activeChat.messages[index]
    if (!msg) return

    const isUser = msg.role === 'user'
    const isLastAi = msg.role === 'character' && index === activeChat.messages.length - 1
    const items: string[] = []

    if (isUser) {
      items.push('编辑', '删除')
    }
    if (isLastAi) {
      items.push('重新生成')
    }

    if (items.length === 0) return

    Taro.showActionSheet({
      itemList: items,
      success: (res) => {
        const action = items[res.tapIndex]
        if (action === '编辑') {
          Taro.showModal({
            title: '编辑消息',
            content: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 小程序不支持 editable modal，用 prompt 方式
                // 此处简化：弹出后直接删除旧消息让用户重新发送
                activeChat.deleteMessage(index)
                setInput(msg.content)
              }
            },
          })
        } else if (action === '删除') {
          Taro.showModal({
            title: '删除消息',
            content: '确定要删除这条消息吗？',
            success: (modalRes) => {
              if (modalRes.confirm) {
                activeChat.deleteMessage(index)
              }
            },
          })
        } else if (action === '重新生成') {
          handleRegenerate()
        }
      },
    })
  }

  // 通讯录直聊模式：返回按钮回到上一页
  const handleDirectChatBack = () => {
    try {
      Taro.navigateBack()
    } catch {
      Taro.switchTab({ url: '/pages/contacts/index' })
    }
  }

  // 卡片集进入模式：返回卡片集
  const handleCardsBack = () => {
    try {
      Taro.navigateBack()
    } catch {
      Taro.switchTab({ url: '/pages/cards/index' })
    }
  }

  // "更多"按钮：从聊天模式切换到角色详情
  const handleShowDetail = () => {
    setView('detail')
  }

  /** 更多菜单：举报 */
  const handleReport = () => {
    setShowMoreMenu(false)
    Taro.showModal({
      title: '举报角色',
      content: '请描述举报原因',
      success: (modalRes) => {
        if (modalRes.confirm) {
          Taro.showToast({ title: '举报已提交', icon: 'success' })
        }
      },
    })
  }

  /** 更多菜单：导出聊天记录 */
  const handleExportChat = () => {
    setShowMoreMenu(false)
    if (activeChat.messages.length === 0) {
      Taro.showToast({ title: '暂无聊天记录', icon: 'none' })
      return
    }
    const exportData = JSON.stringify({
      character: { id: character?.id, name: character?.name },
      messages: activeChat.messages.map(m => ({ role: m.role, content: m.content })),
      exportedAt: new Date().toISOString(),
    }, null, 2)
    Taro.setClipboardData({ data: exportData })
      .then(() => Taro.showToast({ title: '已复制到剪贴板', icon: 'success' }))
      .catch(() => Taro.showToast({ title: '导出失败', icon: 'none' }))
  }

  // 加载中
  if (loading) {
    return (
      <View className='page-character-detail'>
        <View className='page-character-detail-loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  // 错误或未找到
  if (error || !character) {
    return (
      <View className='page-character-detail'>
        <View className='page-character-detail-loading'>
          <Text>角色不存在或加载失败</Text>
        </View>
      </View>
    )
  }

  // ================================================================
  //  Chat View — 内联 AI 角色对话
  // ================================================================
  if (view === 'chat') {
    return (
      <View className='page-character-detail page-character-detail--chat'>
        {/* Chat Header */}
        <View className='page-character-detail-chat-header'>
          <View className='page-character-detail-chat-header-back' onClick={directChat ? handleDirectChatBack : handleBackToDetail}>
            <Icon name='arrow-left' size={36} color='var(--color-icon-action)' />
          </View>
          <View className='page-character-detail-chat-header-info'>
            <Text className='page-character-detail-chat-header-name'>{character.name}</Text>
            <ModelSelector compact />
          </View>
          {directChat && (
            <View className='page-character-detail-chat-header-more' onClick={handleShowDetail}>
              <Icon name='menu' size={36} color='var(--color-primary)' />
            </View>
          )}
        </View>

        {/* Messages */}
        <ScrollView
          className='page-character-detail-chat-messages'
          scrollY
          scrollTop={99999}
          scrollWithAnimation
        >
          <View className='page-character-detail-chat-messages-inner'>
            {activeChat.messages.map((msg, i) => (
              <View key={i} onLongPress={() => handleLongPress(i)}>
                <ChatBubble
                  role={msg.role === 'user' ? 'user' : 'character'}
                  content={msg.content}
                  characterName={msg.role === 'character' ? character.name : undefined}
                  isLast={i === activeChat.messages.length - 1}
                />
              </View>
            ))}
            {activeChat.isStreaming && activeChat.messages.length === 0 && (
              <View className='page-character-detail-chat-typing'>
                <Text>{character.name} 正在输入...</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Input */}
        <View className='page-character-detail-chat-input'>
          <Input
            className='page-character-detail-chat-input-field'
            type='text'
            value={input}
            onInput={e => setInput(e.detail.value)}
            placeholder='输入消息...'
            confirmType='send'
            onConfirm={handleSend}
            disabled={activeChat.isStreaming}
            adjustPosition
            cursorSpacing={20}
          />
          <View
            className={`page-character-detail-chat-input-send ${activeChat.isStreaming ? 'page-character-detail-chat-input-send--disabled' : ''}`}
            onClick={activeChat.isStreaming ? undefined : handleSend}
          >
            <Text>发送</Text>
          </View>
        </View>
      </View>
    )
  }

  // ================================================================
  //  Detail View — 重构布局
  //  第1行: 头像(左) + 名字/标签/统计(右)
  //  第3行: 角色描述
  //  第4行: 提示词（合并场景设定+开场白）
  //  第5行: 对话测试（模型在对话中选择）
  // ================================================================
  const {
    name,
    avatar,
    description,
    prompt,
    tags,
    status,
    chatCount,
    likeCount,
    favCount,
  } = character as CharacterCard & { scenario?: string; firstMsg?: string }

  // 合并提示词展示（兼容旧数据 scenario/firstMsg 尚未迁入 prompt）
  const mergedPrompt = (() => {
    const parts: string[] = []
    if (prompt) parts.push(prompt)
    if (character && 'scenario' in character && character.scenario) parts.push(`\n\n【场景设定】${character.scenario}`)
    if (character && 'firstMsg' in character && character.firstMsg) parts.push(`\n\n【开场白】${character.firstMsg}`)
    return parts.join('')
  })()

  return (
    <ScrollView scrollY className='page-character-detail'>
      {/* 通讯录直聊模式：详情页顶部显示返回按钮 */}
      {directChat && (
        <View className='page-character-detail-chat-header'>
          <View className='page-character-detail-chat-header-back' onClick={() => setView('chat')}>
            <Icon name='arrow-left' size={36} color='var(--color-icon-action)' />
          </View>
          <View className='page-character-detail-chat-header-info'>
            <Text className='page-character-detail-chat-header-name'>角色信息</Text>
          </View>
          <View className='page-character-detail-chat-header-spacer' />
        </View>
      )}
      {/* 从卡片集进入：返回卡片集 */}
      {!directChat && (
        <View className='page-character-detail-back-row' onClick={handleCardsBack}>
          <Text className='page-character-detail-back-arrow'>←</Text>
          <Text className='page-character-detail-back-text'>返回卡片集</Text>
        </View>
      )}

      {/* 第1行：头像(左) + 名字/标签/统计(右) */}
      <View className='page-character-detail-header'>
        <View className='page-character-detail-avatar'>
          {avatar ? (
            <Image src={avatar} mode='aspectFill' className='page-character-detail-avatar-img' />
          ) : (
            <View className='page-character-detail-avatar-placeholder'>
              <Text>{name?.[0] || '?'}</Text>
            </View>
          )}
        </View>

        <View className='page-character-detail-info'>
          <View className='page-character-detail-info-top'>
            <Text className='page-character-detail-name'>{name}</Text>
            {status && status !== 'PUBLISHED' && (
              <Text className='page-character-detail-status-badge'>
                {STATUS_LABELS[status] || status}
              </Text>
            )}
          </View>

          {tags && tags.length > 0 && (
            <View className='page-character-detail-tags'>
              {tags.map((tag, i) => (
                <Text key={i} className='page-character-detail-tag'>{tag}</Text>
              ))}
            </View>
          )}

          <View className='page-character-detail-stats'>
            <Text className='page-character-detail-stat'>
              ♥ {formatCount(likeCount || 0)}
            </Text>
            <Text className='page-character-detail-stat'>
              ★ {formatCount(favCount || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* 第3行：角色描述 */}
      <View className='page-character-detail-section'>
        <Text className='page-character-detail-section-title'>角色描述</Text>
        <Text className='page-character-detail-section-content'>
          {description}
        </Text>
      </View>

      {/* 第4行：提示词（合并） */}
      {mergedPrompt && (
        <View className='page-character-detail-section'>
          <Text className='page-character-detail-section-title'>提示词</Text>
          <Text className='page-character-detail-section-content'>
            {mergedPrompt}
          </Text>
        </View>
      )}

      {/* 第5行：对话测试 */}
      <View className='page-character-detail-chat-test'>
        <View className='page-character-detail-model-row'>
          <Text className='page-character-detail-model-label'>对话模型</Text>
          <ModelSelector compact />
        </View>
        {directChat ? (
          <Button className='page-character-detail-chat-btn' onClick={() => setView('chat')}>
            返回聊天
          </Button>
        ) : (
          <Button className='page-character-detail-chat-btn' onClick={handleStartChat}>
            开始对话
          </Button>
        )}
      </View>

      {/* 操作区 */}
      <View className='page-character-detail-actions'>
        <Button className='page-character-detail-publish-btn' onClick={() => {
          Taro.navigateTo({ url: `/pages/creator/index?id=${character.id}` })
        }}
        >
          编辑角色
        </Button>
        <View className='page-character-detail-more-wrapper'>
          <Button className='page-character-detail-more-btn' onClick={() => setShowMoreMenu(prev => !prev)}>
            更多
          </Button>
          {showMoreMenu && (
            <View className='page-character-detail-more-layer'>
              <View className='page-character-detail-more-overlay' onClick={() => setShowMoreMenu(false)} />
              <View className='page-character-detail-more-dropdown'>
                <View className='page-character-detail-more-dropdown-item' onClick={handleReport}>
                  <Text>举报不当内容</Text>
                </View>
                <View className='page-character-detail-more-dropdown-item' onClick={handleExportChat}>
                  <Text>导出聊天记录</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  )
}
