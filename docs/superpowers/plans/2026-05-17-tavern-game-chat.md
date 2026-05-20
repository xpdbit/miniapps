# Tavern Game Chat Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform AI-Tavern from simple character chat into a game-like group chat system with save system, card-based game setup, AI world generation, WeChat-style chat UI, and model/service provider management moved to profile.

**Architecture:** Client-side only for single-player mode (AI calls direct from client via aiClient.ts). Save data as local JSON via Taro Storage. Card data from existing syncedCardsStore + localCardsStore. No server changes needed.

**Tech Stack:** Taro 4.x + React 18 + TypeScript + Zustand 5 + Taro Storage

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/types/game.ts` | GameSave/GameGroup/GameMessage type definitions |
| `src/services/aiClient.ts` | Client-side AI API provider abstraction |
| `src/stores/gameStore.ts` | Game save/load/CRUD + active save state |
| `src/pages/archive/index.tsx` + `.scss` | Save selection page |
| `src/pages/game-setup/index.tsx` + `.scss` | Card selection + world gen flow |
| `src/components/ConversationItem/index.tsx` + `.scss` | Single conversation row in list |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/chat.ts` | Add pinned, isGroup, memberIds to ChatSession |
| `src/pages/chat/index.tsx` | Dual-state view (conversation list + chat view) |
| `src/pages/chat/index.scss` | Complete rewrite to WeChat style |
| `src/pages/profile/index.tsx` | Add "模型与服务商" block with model picker + API key management |
| `src/pages/profile/index.scss` | Add new block styles |
| `src/components/ChatBubble/index.tsx` | WeChat style bubble (green/white + triangle tails) |
| `src/components/ChatBubble/index.scss` | Complete CSS rewrite |
| `src/hooks/useSSE.ts` | Support configurable endpoint (client-side AI) |
| `src/app.config.ts` | Add archive/game-setup pages, remove settings |
| `src/stores/chatStore.ts` | Extend ChatSession model |

### Deleted Files
| File | Reason |
|------|--------|
| `src/components/ModelSelector/` | Moved into profile page |
| `src/pages/settings/` | Merged into profile page |
| `src/pages/settings/index.tsx` | Merged into profile |

---

### Task 1: Type definitions — game.ts + extend chat.ts

**Files:**
- Create: `src/types/game.ts`
- Modify: `src/types/chat.ts`

- [ ] **Step 1: Create `types/game.ts`**

```typescript
export interface GameSave {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  playerCount: number

  selectedCards: {
    characters: string[]
    mechanics: string[]
    maps: string[]
    backgrounds: string[]
  }

  worldSetting: {
    title: string
    description: string
    rules: string[]
  }

  groups: GameGroup[]
}

export interface GameGroup {
  id: string
  name: string
  memberIds: string[]
  isGroup: true
  lastMessage?: string
  updatedAt?: number
  pinned: boolean
  pinnedAt?: number
}

export interface GameMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  createdAt: number
}
```

- [ ] **Step 2: Extend `types/chat.ts`** — Add fields to ChatSession

```typescript
export interface ChatSession {
  id: string
  characterName?: string
  characterAvatar?: string
  lastMessage?: string
  messageCount?: number
  title?: string
  updatedAt?: string
  // NEW FIELDS:
  pinned?: boolean
  pinnedAt?: number
  isGroup?: boolean
  memberIds?: string[]
}
```

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check` from `apps/tavern/client`
Expected: No errors

---

### Task 2: AI Client — direct API calls

**Files:**
- Create: `src/services/aiClient.ts`

- [ ] **Step 1: Create `services/aiClient.ts`**

```typescript
import Taro from '@tarojs/taro'

export type AiProvider = 'opencode' | 'tongyi' | 'openai' | 'anthropic' | 'deepseek' | 'zhipu' | 'moonshot' | 'minimax'

export interface AiClientConfig {
  provider: AiProvider
  model: string
  apiKey?: string
  baseUrl?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const PROVIDER_CONFIGS: Record<AiProvider, { baseUrl: string; defaultModel: string }> = {
  opencode: {
    baseUrl: 'https://api.opencode.com/v1/chat/completions',
    defaultModel: 'qwen-turbo',
  },
  tongyi: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-haiku-20240307',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
  },
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    defaultModel: 'abab6.5s',
  },
}

function getConfig(provider: AiProvider, model?: string): { baseUrl: string; model: string } {
  const cfg = PROVIDER_CONFIGS[provider]
  return {
    baseUrl: cfg.baseUrl,
    model: model || cfg.defaultModel,
  }
}

export async function aiGenerateText(
  config: AiClientConfig,
  messages: ChatMessage[],
): Promise<string> {
  const { baseUrl, model } = getConfig(config.provider, config.model)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  try {
    const res = await Taro.request({
      url: baseUrl,
      method: 'POST',
      header: headers,
      data: {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      },
      timeout: 60000,
    })
    return res.data?.choices?.[0]?.message?.content || ''
  } catch (err) {
    console.error('[aiClient] generate error:', err)
    throw err
  }
}

export async function aiGenerateJSON<T>(
  config: AiClientConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const text = await aiGenerateText(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ])
  // Try to parse JSON from response (may have markdown wrapping)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/)
  const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text
  return JSON.parse(jsonStr)
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 3: Game Store — save/load game state

**Files:**
- Create: `src/stores/gameStore.ts`

- [ ] **Step 1: Create `stores/gameStore.ts`**

```typescript
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { GameSave, GameGroup, GameMessage } from '@/types/game'

const SAVES_KEY = 'tavern_saves'
const ACTIVE_KEY = 'tavern_active_save_id'

function generateId(): string {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function persistSaves(saves: GameSave[]) {
  try { Taro.setStorageSync(SAVES_KEY, saves) } catch { /* ignore */ }
}

function loadSaves(): GameSave[] {
  try {
    const data = Taro.getStorageSync(SAVES_KEY)
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

interface GameState {
  saves: GameSave[]
  activeSaveId: string | null

  /** Get active save object */
  activeSave: () => GameSave | null

  /** Load saves from storage */
  restoreSaves: () => void

  /** Create a new save */
  createSave: (data: Omit<GameSave, 'id' | 'createdAt' | 'updatedAt'>) => GameSave

  /** Delete a save */
  deleteSave: (id: string) => void

  /** Rename a save */
  renameSave: (id: string, name: string) => void

  /** Set active save */
  setActiveSave: (id: string | null) => void

  /** Update save groups (after world gen) */
  updateSaveGroups: (saveId: string, groups: GameGroup[]) => void

  /** Add message to a group in active save */
  addMessage: (groupId: string, msg: GameMessage) => void

  /** Update group last message */
  updateGroupLastMessage: (groupId: string, msg: string) => void

  /** Toggle group pinned state */
  togglePinned: (groupId: string) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  saves: [],
  activeSaveId: null,

  activeSave: () => {
    const { saves, activeSaveId } = get()
    if (!activeSaveId) return null
    return saves.find(s => s.id === activeSaveId) || null
  },

  restoreSaves: () => {
    set({ saves: loadSaves() })
    try {
      const id = Taro.getStorageSync(ACTIVE_KEY)
      if (id) set({ activeSaveId: id })
    } catch { /* ignore */ }
  },

  createSave: (data) => {
    const now = Date.now()
    const save: GameSave = { ...data, id: generateId(), createdAt: now, updatedAt: now }
    const newSaves = [save, ...get().saves]
    set({ saves: newSaves, activeSaveId: save.id })
    persistSaves(newSaves)
    try { Taro.setStorageSync(ACTIVE_KEY, save.id) } catch { /* ignore */ }
    return save
  },

  deleteSave: (id) => {
    const newSaves = get().saves.filter(s => s.id !== id)
    set({ saves: newSaves, activeSaveId: get().activeSaveId === id ? null : get().activeSaveId })
    persistSaves(newSaves)
  },

  renameSave: (id, name) => {
    const newSaves = get().saves.map(s => s.id === id ? { ...s, name, updatedAt: Date.now() } : s)
    set({ saves: newSaves })
    persistSaves(newSaves)
  },

  setActiveSave: (id) => {
    set({ activeSaveId: id })
    try { Taro.setStorageSync(ACTIVE_KEY, id || '') } catch { /* ignore */ }
  },

  updateSaveGroups: (saveId, groups) => {
    const newSaves = get().saves.map(s =>
      s.id === saveId ? { ...s, groups, updatedAt: Date.now() } : s
    )
    set({ saves: newSaves })
    persistSaves(newSaves)
  },

  addMessage: (groupId, msg) => {
    const save = get().activeSave()
    if (!save) return
    const newGroups = save.groups.map(g =>
      g.id === groupId
        ? { ...g, messages: [...(g as any).messages || [], msg], lastMessage: msg.content, updatedAt: Date.now() }
        : g
    )
    get().updateSaveGroups(save.id, newGroups)
  },

  updateGroupLastMessage: (groupId, msg) => {
    const save = get().activeSave()
    if (!save) return
    const newGroups = save.groups.map(g =>
      g.id === groupId ? { ...g, lastMessage: msg, updatedAt: Date.now() } : g
    )
    get().updateSaveGroups(save.id, newGroups)
  },

  togglePinned: (groupId) => {
    const save = get().activeSave()
    if (!save) return
    const newGroups = save.groups.map(g =>
      g.id === groupId
        ? { ...g, pinned: !g.pinned, pinnedAt: g.pinned ? undefined : Date.now() }
        : g
    )
    get().updateSaveGroups(save.id, newGroups)
  },
}))
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 4: Profile page — add model/service provider block

**Files:**
- Modify: `src/pages/profile/index.tsx`
- Modify: `src/pages/profile/index.scss`

- [ ] **Step 1: Read current profile/index.tsx to understand structure**

- [ ] **Step 2: Add model/provider section after quota bar**

After the quota progress bar (`.page-profile-quota-bar`), insert new block:

```tsx
{/* 模型与服务商 */}
<View className='page-profile-section'>
  <View className='page-profile-section-header' onClick={() => setShowModelSection(!showModelSection)}>
    <Text className='page-profile-section-title'>模型与服务商</Text>
    <Text className='page-profile-section-arrow'>{showModelSection ? '▼' : '▶'}</Text>
  </View>
  {showModelSection && (
    <View className='page-profile-section-body'>
      {/* Model picker */}
      <View className='page-profile-model-row'>
        <Text className='page-profile-model-label'>当前模型</Text>
        <Picker
          mode='selector'
          range={MODEL_NAMES}
          value={modelIndex}
          onChange={handleModelChange}
        >
          <View className='page-profile-model-value'>
            <Text className='page-profile-model-name'>{currentModel?.name || '选择模型'}</Text>
            <Icon name='arrow-down' size={24} color='#999' />
          </View>
        </Picker>
      </View>

      {/* API Key summary */}
      <View className='page-profile-apikey-summary'>
        <Text className='page-profile-apikey-summary-text'>
          API Key: {configuredCount}/{PROVIDERS.length} 已配置
        </Text>
        <Text className='page-profile-apikey-expand' onClick={() => setShowKeys(!showKeys)}>
          {showKeys ? '收起' : '展开 ›'}
        </Text>
      </View>

      {/* Expanded key list */}
      {showKeys && (
        <View className='page-profile-apikey-list'>
          {PROVIDERS.map(provider => {
            const existKey = keys.find(k => k.provider === provider.key)
            return (
              <View key={provider.key} className='page-profile-apikey-item'>
                <Text className='page-profile-apikey-icon'>{provider.icon}</Text>
                <View className='page-profile-apikey-info'>
                  <Text className='page-profile-apikey-name'>{provider.name}</Text>
                  <Text className='page-profile-apikey-desc'>{existKey ? '已配置' : '未配置'}</Text>
                </View>
                {existKey ? (
                  <Text className='page-profile-apikey-delete' onClick={() => handleDeleteKey(existKey.id)}>删除</Text>
                ) : (
                  <Text className='page-profile-apikey-add' onClick={() => { setSelectedProvider(provider.key); setShowModal(true) }}>
                    {provider.free ? '启用' : '添加'}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )}
</View>
```

State vars to add:
```typescript
const [showModelSection, setShowModelSection] = useState(false)
const [showKeys, setShowKeys] = useState(false)
// Reuse PROVIDERS from settings page
// Reuse AI Client config from aiClient.ts
```

- [ ] **Step 3: Add styles to `profile/index.scss`**

```scss
.page-profile-section {
  margin: var(--spacing-md);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;

  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
  }

  &-title {
    font-size: var(--font-body);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
  }

  &-arrow {
    font-size: var(--font-caption);
    color: var(--color-text-tertiary);
  }

  &-body {
    padding: 0 var(--spacing-md) var(--spacing-md);
  }
}

.page-profile-model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.page-profile-model-label {
  font-size: var(--font-body-sm);
  color: var(--color-text-secondary);
}

.page-profile-model-value {
  display: flex;
  align-items: center;
  gap: var(--spacing-2xs);
}

.page-profile-model-name {
  font-size: var(--font-body-sm);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.page-profile-apikey-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.page-profile-apikey-summary-text {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

.page-profile-apikey-expand {
  font-size: var(--font-caption);
  color: var(--color-primary);
}

.page-profile-apikey-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.page-profile-apikey-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
}

.page-profile-apikey-icon {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
}

.page-profile-apikey-info {
  flex: 1;
}

.page-profile-apikey-name {
  font-size: var(--font-body-sm);
  color: var(--color-text);
  display: block;
}

.page-profile-apikey-desc {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.page-profile-apikey-add {
  font-size: var(--font-caption);
  color: var(--color-primary);
  padding: 4rpx 12rpx;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill);
}

.page-profile-apikey-delete {
  font-size: var(--font-caption);
  color: var(--color-danger, #FF3B30);
}
```

- [ ] **Step 4: Add PROFILE_QUOTA import and remove scrollView from global**

Add at top of profile/index.tsx:
```typescript
import { Picker } from '@tarojs/components'
import { useChatStore } from '@/stores/chatStore'
// PROVIDERS list and model options from existing settings
```

- [ ] **Step 5: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 5: ChatBubble — WeChat style redesign

**Files:**
- Modify: `src/components/ChatBubble/index.tsx`
- Modify: `src/components/ChatBubble/index.scss`

- [ ] **Step 1: Rewrite `ChatBubble/index.scss` — WeChat style**

```scss
.chat-bubble {
  display: flex;
  margin-bottom: var(--spacing-md);
  align-items: flex-start;
  gap: var(--spacing-xs);

  &--user {
    flex-direction: row-reverse;
  }

  &--character {
    flex-direction: row;
  }

  /* Avatar — only for character, 72rpx */
  &-avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    overflow: hidden;
    background: var(--color-bg-muted);
  }

  &-avatar-img {
    width: 100%;
    height: 100%;
  }

  &-avatar-text {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary);
    color: #fff;
    font-size: var(--font-body);
    font-weight: var(--font-weight-semibold);
  }

  /* Body container */
  &-body {
    display: flex;
    flex-direction: column;
    max-width: 65%;
    min-width: 0;

    &--user {
      align-items: flex-end;
    }
  }

  /* Sender name (character only) */
  &-name {
    font-size: 24rpx;
    color: var(--color-text-tertiary);
    margin-bottom: 4rpx;
    padding: 0 8rpx;
  }

  /* Bubble content */
  &-content {
    padding: 12rpx 16rpx;
    font-size: 32rpx;
    line-height: 1.6;
    word-break: break-word;
    position: relative;
  }

  /* User bubble: green, right, triangle on right */
  &--user &-content {
    background: #07C160;
    color: #FFFFFF;
    border-radius: 10rpx;
  }

  &--user &-body {
    align-items: flex-end;
  }

  /* User bubble: triangle tail (right side) */
  &--user &-content::after {
    content: '';
    position: absolute;
    top: 20rpx;
    right: -12rpx;
    border: 12rpx solid transparent;
    border-left: 12rpx solid #07C160;
    border-top: 0;
  }

  /* Character bubble: white, left, triangle on left */
  &--character &-content {
    background: #FFFFFF;
    color: #1A1A1A;
    border-radius: 10rpx;
    box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
  }

  &--character &-content::after {
    content: '';
    position: absolute;
    top: 20rpx;
    left: -12rpx;
    border: 12rpx solid transparent;
    border-right: 12rpx solid #FFFFFF;
    border-top: 0;
  }

  /* Time stamp */
  &-time {
    font-size: 24rpx;
    color: var(--color-text-tertiary);
    margin-top: 4rpx;
    padding: 0 8rpx;
  }

  &--user &-time {
    text-align: right;
  }

  /* Streaming dots */
  &-dots {
    display: inline-flex;
    align-items: center;
    gap: 4rpx;
    margin-left: 4rpx;
    vertical-align: middle;
  }

  &-dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: var(--radius-full);
    background: #07C160;
    animation: chat-bubble-dot-jump 1.4s ease-in-out infinite both;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }

  &--character &-dot {
    background: var(--color-primary);
  }
}

@keyframes chat-bubble-dot-jump {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-8rpx); opacity: 1; }
}

/* Time separator in message list */
.chat-time-separator {
  text-align: center;
  padding: var(--spacing-sm) 0;
  font-size: 24rpx;
  color: var(--color-text-tertiary);
}
```

- [ ] **Step 2: Rewrite `ChatBubble/index.tsx`**

```typescript
import { View, Text, Image } from '@tarojs/components'
import { cn } from '@/utils'
import './index.scss'

interface ChatBubbleProps {
  role: 'user' | 'character'
  content: string
  isStreaming?: boolean
  isLast?: boolean
  avatarUrl?: string | null
  characterName?: string
  timestamp?: string | number
}

export default function ChatBubble({
  role,
  content,
  isStreaming = false,
  isLast = false,
  avatarUrl,
  characterName,
  timestamp,
}: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <View className={cn('chat-bubble', `chat-bubble--${role}`, isLast && 'chat-bubble--enter')}>
      {!isUser && (
        <View className='chat-bubble-avatar'>
          {avatarUrl ? (
            <Image src={avatarUrl} mode='aspectFill' className='chat-bubble-avatar-img' />
          ) : (
            <Text className='chat-bubble-avatar-text'>{characterName?.[0] || '?'}</Text>
          )}
        </View>
      )}
      <View className={cn('chat-bubble-body', isUser && 'chat-bubble-body--user')}>
        {!isUser && characterName && (
          <Text className='chat-bubble-name'>{characterName}</Text>
        )}
        <View className={cn('chat-bubble-content', isStreaming && 'chat-bubble-content--streaming')}>
          <Text>{content}</Text>
          {isStreaming && (
            <View className='chat-bubble-dots'>
              <View className='chat-bubble-dot' />
              <View className='chat-bubble-dot' />
              <View className='chat-bubble-dot' />
            </View>
          )}
        </View>
        {timestamp && (
          <Text className='chat-bubble-time'>
            {typeof timestamp === 'string' ? timestamp : formatTime(timestamp)}
          </Text>
        )}
      </View>
    </View>
  )
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${h}:${m}`
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day} ${h}:${m}`
}
```

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 6: Chat page — WeChat dual-state view

**Files:**
- Modify: `src/pages/chat/index.tsx`
- Modify: `src/pages/chat/index.scss`

- [ ] **Step 1: Rewrite `chat/index.tsx` — Dual state view**

Replace entire file with new implementation:

```typescript
import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useEffect, useCallback } from 'react'

import ChatBubble from '@/components/ChatBubble'
import { useGameStore } from '@/stores/gameStore'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { Icon } from '@/components'
import type { GameGroup, GameMessage } from '@/types/game'
import { cn } from '@/utils'
import './index.scss'

export default function ChatPage() {
  const { activeSave, setActiveSave, togglePinned, addMessage } = useGameStore()
  const { isLoggedIn } = useAuthStore()
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [activeGroup, setActiveGroup] = useState<GameGroup | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<ReturnType<typeof setTimeout>>()

  const save = activeSave()

  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 1)
  })

  // Sort groups: pinned first, then by updatedAt
  const sortedGroups = save?.groups
    ? [...save.groups].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        if (a.pinned && b.pinned && a.pinnedAt && b.pinnedAt) return b.pinnedAt - a.pinnedAt
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      })
    : []

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !activeGroup) return
    setInput('')
    const msg: GameMessage = {
      id: Date.now().toString(36),
      senderId: 'player',
      senderName: '我',
      content: text,
      createdAt: Date.now(),
    }
    addMessage(activeGroup.id, msg)
    useGameStore.getState().updateGroupLastMessage(activeGroup.id, text)
  }, [input, activeGroup, addMessage])

  const handleGroupClick = (group: GameGroup) => {
    setActiveGroup(group)
    setView('chat')
  }

  const handleBack = () => {
    setView('list')
    setActiveGroup(null)
  }

  // No save selected
  if (!save) {
    return (
      <View className='page-chat-empty'>
        <Icon name='chat' size={72} color='#C4BFB8' />
        <Text className='page-chat-empty-title'>暂无游戏会话</Text>
        <Text className='page-chat-empty-subtitle'>请先选择存档或开始新游戏</Text>
        <View className='page-chat-empty-btn' onClick={() => Taro.navigateTo({ url: '/pages/archive/index' })}>
          选择存档
        </View>
      </View>
    )
  }

  // State A: Conversation List
  if (view === 'list') {
    return (
      <View className='page-chat'>
        <View className='page-chat-list-header'>
          <Text className='page-chat-list-header-title'>AI 酒馆</Text>
          <View className='page-chat-list-header-actions'>
            <Text className='page-chat-list-header-btn' onClick={() => Taro.navigateTo({ url: '/pages/archive/index' })}>
              存档
            </Text>
          </View>
        </View>

        <ScrollView className='page-chat-list' scrollY>
          {sortedGroups.map(group => (
            <View
              key={group.id}
              className={cn('page-chat-list-item', group.pinned && 'page-chat-list-item--pinned')}
              onClick={() => handleGroupClick(group)}
            >
              <View className='page-chat-list-item-avatar'>
                <Text className='page-chat-list-item-avatar-text'>{(group.name?.[0] || '?')}</Text>
              </View>
              <View className='page-chat-list-item-info'>
                <View className='page-chat-list-item-top'>
                  <Text className='page-chat-list-item-name'>{group.name}</Text>
                  {group.updatedAt && (
                    <Text className='page-chat-list-item-time'>
                      {formatGroupTime(group.updatedAt)}
                    </Text>
                  )}
                </View>
                <Text className='page-chat-list-item-preview'>
                  {group.memberIds.length > 1 ? `${group.memberIds.length} 人参与` : group.lastMessage || ''}
                </Text>
              </View>
              {group.pinned && <Text className='page-chat-list-item-pin'>📌</Text>}
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  // State B: Chat View
  const messages: GameMessage[] = activeGroup ? (save.groups.find(g => g.id === activeGroup.id) as any)?.messages || [] : []

  return (
    <View className='page-chat'>
      {/* Header */}
      <View className='page-chat-header'>
        <View className='page-chat-header-back' onClick={handleBack}>
          <Icon name='arrow-left' size={36} color='#007AFF' />
        </View>
        <Text className='page-chat-header-title'>{activeGroup?.name || '聊天'}</Text>
        <View className='page-chat-header-spacer' />
      </View>

      {/* Messages */}
      <ScrollView className='page-chat-messages' scrollY scrollWithAnimation id='chat-scroll'>
        <View className='page-chat-messages-inner'>
          {/* World description banner */}
          <View className='page-chat-world-banner'>
            <Text className='page-chat-world-title'>{save.worldSetting.title}</Text>
            <Text className='page-chat-world-desc'>{save.worldSetting.description}</Text>
          </View>
          {messages.map((msg, i) => (
            <ChatBubble
              key={msg.id}
              role={msg.senderId === 'player' ? 'user' : 'character'}
              content={msg.content}
              characterName={msg.senderName}
              timestamp={msg.createdAt}
              avatarUrl={undefined}
              isLast={i === messages.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      {/* Input */}
      <View className='page-chat-input'>
        <View className='page-chat-input-voice'>
          <Text>🎤</Text>
        </View>
        <Input
          className='page-chat-input-field'
          value={input}
          onInput={e => setInput(e.detail.value)}
          placeholder='输入消息...'
          onConfirm={handleSend}
        />
        <View className='page-chat-input-actions'>
          <Text>😊</Text>
          <Text className='page-chat-input-send' onClick={handleSend}>发送</Text>
        </View>
      </View>
    </View>
  )
}

function formatGroupTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${h}:${m}`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return `${date.getMonth() + 1}/${date.getDate()}`
}
```

- [ ] **Step 2: Rewrite `chat/index.scss` — WeChat style**

```scss
.page-chat {
  height: calc(100vh - var(--tab-bar-height, 120rpx) - 1rpx - env(safe-area-inset-bottom, 0));
  display: flex;
  flex-direction: column;
  background: #F5F5F5;

  &-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    padding: var(--spacing-xl);

    &-title {
      font-size: var(--font-body);
      color: var(--color-text-secondary);
    }

    &-subtitle {
      font-size: var(--font-caption);
      color: var(--color-text-tertiary);
    }

    &-btn {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: #07C160;
      color: #fff;
      border-radius: var(--radius-pill);
      font-size: var(--font-body-sm);
    }
  }

  /* ── State A: Conversation List ── */
  &-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    padding-top: calc(var(--spacing-sm) + env(safe-area-inset-top, 0));
    background: #FFFFFF;
    border-bottom: 1px solid #E5E5E5;

    &-title {
      font-size: var(--font-title);
      font-weight: var(--font-weight-bold);
      color: #1A1A1A;
    }

    &-btn {
      font-size: var(--font-body-sm);
      color: #07C160;
      padding: 4rpx 12rpx;
    }
  }

  &-list {
    flex: 1;
    background: #FFFFFF;

    &-item {
      display: flex;
      align-items: center;
      padding: var(--spacing-sm) var(--spacing-md);
      border-bottom: 1px solid #F0F0F0;
      position: relative;

      &:active {
        background: #F5F5F5;
      }

      &--pinned {
        background: #FAFAFA;
      }

      &-avatar {
        width: 96rpx;
        height: 96rpx;
        border-radius: var(--radius-sm);
        background: #07C160;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: var(--spacing-sm);
      }

      &-avatar-text {
        font-size: var(--font-body-lg);
        color: #fff;
        font-weight: var(--font-weight-semibold);
      }

      &-info {
        flex: 1;
        min-width: 0;
      }

      &-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4rpx;
      }

      &-name {
        font-size: var(--font-body);
        color: #1A1A1A;
        font-weight: var(--font-weight-medium);
      }

      &-time {
        font-size: 24rpx;
        color: var(--color-text-tertiary);
        flex-shrink: 0;
      }

      &-preview {
        font-size: var(--font-caption);
        color: var(--color-text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &-pin {
        position: absolute;
        top: 4rpx;
        right: 8rpx;
        font-size: 24rpx;
      }
    }
  }

  /* ── State B: Chat View ── */
  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    padding-top: calc(var(--spacing-sm) + env(safe-area-inset-top, 0));
    background: #FFFFFF;
    border-bottom: 1px solid #E5E5E5;

    &-back {
      padding: var(--spacing-xs);
    }

    &-title {
      font-size: var(--font-body);
      font-weight: var(--font-weight-semibold);
      color: #1A1A1A;
    }

    &-spacer {
      width: 60rpx;
    }
  }

  &-messages {
    flex: 1;
    overflow-y: auto;
    background: #F5F5F5;

    &-inner {
      padding: var(--spacing-md);
    }
  }

  &-world-banner {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: var(--radius-lg);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);

    &-title {
      font-size: var(--font-body);
      font-weight: var(--font-weight-semibold);
      color: #fff;
      display: block;
      margin-bottom: var(--spacing-xs);
    }

    &-desc {
      font-size: var(--font-caption);
      color: rgba(255, 255, 255, 0.85);
      line-height: var(--leading-relaxed);
    }
  }

  /* Input area */
  &-input {
    display: flex;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-md);
    padding-bottom: calc(var(--spacing-xs) + env(safe-area-inset-bottom, 0));
    background: #FFFFFF;
    border-top: 1px solid #E5E5E5;
    gap: var(--spacing-xs);

    &-voice {
      width: 56rpx;
      height: 56rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    &-field {
      flex: 1;
      height: 68rpx;
      background: #F0F0F0;
      border-radius: 8rpx;
      padding: 0 var(--spacing-sm);
      font-size: var(--font-body-sm);
      color: #1A1A1A;
    }

    &-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      flex-shrink: 0;
    }

    &-send {
      font-size: var(--font-body-sm);
      color: #07C160;
      font-weight: var(--font-weight-semibold);
      padding: 4rpx 12rpx;
    }
  }
}
```

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 7: Delete ModelSelector component and settings page

**Files:**
- Delete: `src/components/ModelSelector/` (entire directory)
- Delete: `src/pages/settings/` (entire directory)

- [ ] **Step 1: Remove ModelSelector import from chat/index.tsx**

- [ ] **Step 2: Verify no remaining imports**

Search for any remaining imports of ModelSelector or settings.

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 8: Archive selection page

**Files:**
- Create: `src/pages/archive/index.tsx`
- Create: `src/pages/archive/index.scss`

- [ ] **Step 1: Create `pages/archive/index.tsx`**

```typescript
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { Icon } from '@/components'
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

  const handleDelete = async (id: string, e: any) => {
    e.stopPropagation()
    try {
      await Taro.showModal({ title: '确认删除', content: '删除后不可恢复' })
    } catch {
      return
    }
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
```

- [ ] **Step 2: Create `pages/archive/index.scss`**

```scss
.page-archive {
  min-height: 100vh;
  background: #F5F5F5;
  display: flex;
  flex-direction: column;

  &-header {
    padding: var(--spacing-md);
    padding-top: calc(var(--spacing-md) + env(safe-area-inset-top, 0));
    background: #FFFFFF;

    &-title {
      font-size: var(--font-title);
      font-weight: var(--font-weight-bold);
      color: #1A1A1A;
    }
  }

  &-list {
    flex: 1;
    padding: var(--spacing-sm);
  }

  &-item {
    display: flex;
    align-items: center;
    padding: var(--spacing-md);
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-sm);

    &:active {
      background: #F5F5F5;
    }

    &-icon {
      width: 80rpx;
      height: 80rpx;
      border-radius: var(--radius-sm);
      background: #F0F0F0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: var(--spacing-sm);
      flex-shrink: 0;
    }

    &-icon-text {
      font-size: 40rpx;
    }

    &-info {
      flex: 1;
      min-width: 0;
    }

    &-name {
      font-size: var(--font-body);
      color: #1A1A1A;
      font-weight: var(--font-weight-medium);
      display: block;
      margin-bottom: 4rpx;
    }

    &-meta {
      font-size: var(--font-caption);
      color: var(--color-text-tertiary);
    }

    &-delete {
      font-size: var(--font-caption);
      color: #FF3B30;
      padding: var(--spacing-xs);
    }
  }

  &-footer {
    padding: var(--spacing-md);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0));
    background: #FFFFFF;
  }

  &-new-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background: #07C160;
    color: #FFFFFF;
    border-radius: var(--radius-lg);
    font-size: var(--font-body);
    font-weight: var(--font-weight-semibold);

    &:active {
      opacity: 0.8;
    }

    &-icon {
      font-size: var(--font-title);
      font-weight: 300;
    }
  }
}
```

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 9: Game setup page — card selection flow

**Files:**
- Create: `src/pages/game-setup/index.tsx`
- Create: `src/pages/game-setup/index.scss`

- [ ] **Step 1: Create `pages/game-setup/index.tsx`**

This page has 4 selection steps + 1 confirm step.

```typescript
import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'

import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import { aiGenerateJSON, AiClientConfig } from '@/services/aiClient'
import { useChatStore } from '@/stores/chatStore'
import { Icon } from '@/components'
import type { CardType, CharacterCard, LocalCard } from '@/types/character'
import type { GameGroup } from '@/types/game'
import './index.scss'

type Step = 'characters' | 'mechanics' | 'maps' | 'backgrounds' | 'confirm'

interface SelectedCards {
  characters: (CharacterCard | LocalCard)[]
  mechanics: (CharacterCard | LocalCard)[]
  maps: (CharacterCard | LocalCard)[]
  backgrounds: (CharacterCard | LocalCard)[]
}

const STEP_LABELS: Record<Step, string> = {
  characters: '选择角色卡',
  mechanics: '选择机制卡',
  maps: '选择地图卡',
  backgrounds: '选择背景卡',
  confirm: '确认',
}

const CARD_TYPES: { step: Step; cardType: CardType; min: number; max: number }[] = [
  { step: 'characters', cardType: 'CHARACTER', min: 2, max: 5 },
  { step: 'mechanics', cardType: 'MECHANISM', min: 1, max: 2 },
  { step: 'maps', cardType: 'MAP', min: 1, max: 1 },
  { step: 'backgrounds', cardType: 'BACKGROUND', min: 1, max: 1 },
]

export default function GameSetupPage() {
  const [step, setStep] = useState<Step>('characters')
  const [saves, setSaves] = useState<SelectedCards>({
    characters: [],
    mechanics: [],
    maps: [],
    backgrounds: [],
  })
  const [saveName, setSaveName] = useState('')
  const [generating, setGenerating] = useState(false)

  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const { createSave, updateSaveGroups } = useGameStore()
  const selectedModel = useChatStore(s => s.selectedModel)

  // Get cards for current step
  const currentStep = CARD_TYPES.find(c => c.step === step)!
  const syncedCards = syncedStore.getCardsByType(currentStep.cardType)
  const localCards = localStore.getCardsByType(currentStep.cardType)
  const allCards = [...syncedCards, ...localCards]

  const toggleCard = (card: CharacterCard | LocalCard) => {
    const key = step as keyof SelectedCards
    const selected = saves[key]
    const exists = selected.find(c => c.id === card.id)
    if (exists) {
      setSaves({ ...saves, [key]: selected.filter(c => c.id !== card.id) })
    } else if (selected.length < currentStep.max) {
      setSaves({ ...saves, [key]: [...selected, card] })
    }
  }

  const canProceed = saves[step as keyof SelectedCards].length >= currentStep.min

  const handleNext = () => {
    const currentIdx = CARD_TYPES.findIndex(c => c.step === step)
    if (currentIdx < CARD_TYPES.length - 1) {
      setStep(CARD_TYPES[currentIdx + 1]!.step)
    } else {
      setStep('confirm')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      // Build prompt payload
      const cardsData = {
        characters: saves.characters.map(c => ({ id: c.id, name: c.name, description: c.description, personality: c.personality })),
        mechanics: saves.mechanics.map(c => ({ id: c.id, name: c.name, description: c.description })),
        maps: saves.maps.map(c => ({ id: c.id, name: c.name, description: c.description })),
        backgrounds: saves.backgrounds.map(c => ({ id: c.id, name: c.name, description: c.description })),
      }

      const systemPrompt = `你是一个游戏世界构建师。基于卡牌组合构建世界观，并将角色分配到群组中。
以 JSON 格式返回（不要 markdown 包裹）：
{
  "worldSetting": { "title": "世界观标题", "description": "世界观描述", "rules": ["规则1", "规则2"] },
  "groups": [{ "name": "群组名称", "memberIds": ["角色ID"] }]
}
要求：群组 2-4 个，每个角色至少属于一个群组，第一个群组为"世界公告群"包含所有角色。`

      const userMessage = `角色卡: ${JSON.stringify(cardsData.characters)}
机制卡: ${JSON.stringify(cardsData.mechanics)}
地图卡: ${JSON.stringify(cardsData.maps)}
背景卡: ${JSON.stringify(cardsData.backgrounds)}`

      const aiConfig: AiClientConfig = {
        provider: 'opencode',
        model: 'qwen-plus',
      }

      interface GenResult {
        worldSetting: { title: string; description: string; rules: string[] }
        groups: Array<{ name: string; memberIds: string[] }>
      }

      const result = await aiGenerateJSON<GenResult>(aiConfig, systemPrompt, userMessage)

      // Create save
      const save = createSave({
        name: saveName || result.worldSetting.title,
        playerCount: saves.characters.length,
        selectedCards: {
          characters: saves.characters.map(c => c.id),
          mechanics: saves.mechanics.map(c => c.id),
          maps: saves.maps.map(c => c.id),
          backgrounds: saves.backgrounds.map(c => c.id),
        },
        worldSetting: result.worldSetting,
        groups: result.groups.map((g, i) => ({
          id: 'group_' + Date.now().toString(36) + '_' + i,
          name: g.name,
          memberIds: g.memberIds,
          isGroup: true,
          pinned: true,
          pinnedAt: Date.now() - i * 1000,
          lastMessage: i === 0 ? '欢迎来到 ' + result.worldSetting.title : undefined,
          updatedAt: Date.now(),
        })),
      })

      updateSaveGroups(save.id, save.groups)
      await Taro.showToast({ title: '世界构建完成!', icon: 'success' })
      Taro.switchTab({ url: '/pages/chat/index' })
    } catch (err) {
      console.error('[generate] error:', err)
      Taro.showToast({ title: '世界构建失败，请重试', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  // ... render step content based on `step`
  // (see full implementation in actual file)
  // For brevity here - the actual file renders:
  // Step characters: grid of CHARACTER cards
  // Step mechanics: grid of MECHANISM cards  
  // Step maps: single-select MAP cards
  // Step backgrounds: single-select BACKGROUND cards
  // Step confirm: summary + name input + [开始游戏] button
}
```

(Full render implementation in actual file follows the pattern: for each step, show card grid with select/unselect, bottom bar with progress dots + next/confirm button.)

- [ ] **Step 2: Create `pages/game-setup/index.scss`** — clean step-by-step card selection styles

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check`
Expected: No errors

---

### Task 10: App config + final wiring

**Files:**
- Modify: `src/app.config.ts`

- [ ] **Step 1: Update `app.config.ts`**

Add new pages and remove settings:

```typescript
pages: [
  'pages/market/index',
  'pages/chat/index',
  'pages/archive/index',       // NEW
  'pages/game-setup/index',    // NEW
  'pages/character/index',
  'pages/character/detail/index',
  'pages/creator/index',
  'pages/profile/index',
  'pages/persona/index',
  // 'pages/settings/index',    // REMOVED
],
```

- [ ] **Step 2: Verify no broken references**

Search for any `Taro.navigateTo({ url: '/pages/settings/...' })` and replace with profile navigation.

- [ ] **Step 3: Build verification**

Run: `npm run build:weapp`
Expected: Compiled successfully

---

### Task 11: useSSE hook — support client-side AI

**Files:**
- Modify: `src/hooks/useSSE.ts`

- [ ] **Step 1: Read current useSSE.ts and add config parameter**

The current SSE hook connects to the tavern server. Add an optional config parameter to connect directly to AI provider instead.

```typescript
// Add new parameter:
interface SSEConfig {
  mode: 'server' | 'client'
  aiConfig?: AiClientConfig
}

// When mode is 'client', use aiClient.ts stream method instead of server SSE
// When mode is 'server' (default), use existing server SSE logic
```

---

### Task 12: Build and verify

- [ ] **Step 1: Run type-check**

Run: `npm run type-check`
Expected: Clean

- [ ] **Step 2: Run build**

Run: `npm run build:weapp`
Expected: Compiled successfully

- [ ] **Step 3: Oracle verification**

Final verification pass over all changed files.
