# 配卡方案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Implement 配卡方案 feature + market→cards cleanup as specified in `plan/specs/tavern-card-scheme-design.md`

**Architecture:** Backend serves official schemes as hardcoded JSON via new `/api/v1/card-schemes` route. Frontend adds Zustand store (localStorage for user schemes, API for official), new detail page (navigateTo), new 配卡 sub-tab on cards page, and "保存为配卡方案" button on game-setup. AI generation utils extracted to shared module for reuse. market→cards rename on both frontend and backend.

**Tech Stack:** Express + Prisma (backend), Taro 4 + React 18 + Zustand 5 (frontend)

---

### Task 1: Rename frontend marketService.ts → cardService.ts

**Files:**
- Rename: `apps/tavern/client/src/services/marketService.ts` → `apps/tavern/client/src/services/cardService.ts`
- Modify: `apps/tavern/client/src/services/marketService.ts` (delete old)

- [ ] **Step 1: Create cardService.ts**

Copy `apps/tavern/client/src/services/marketService.ts` to `apps/tavern/client/src/services/cardService.ts` with updated naming:

```typescript
import { httpClient } from './httpClient'

export const cardService = {
  list: <T = unknown>(params?: { page?: number; pageSize?: number; sort?: string; tag?: string }) =>
    httpClient.get<T>('/market', params),
  featured: <T = unknown>() =>
    httpClient.get<T>('/market/featured'),
  search: <T = unknown>(q: string, page?: number) =>
    httpClient.get<T>('/market/search', { q, page }),
  tags: <T = unknown>() =>
    httpClient.get<T>('/market/tags'),
  detail: <T = unknown>(id: string) =>
    httpClient.get<T>(`/market/${id}`),
  like: <T = unknown>(id: string) =>
    httpClient.post<T>(`/market/${id}/like`),
  unlike: <T = unknown>(id: string) =>
    httpClient.delete<T>(`/market/${id}/like`),
  fav: <T = unknown>(id: string) =>
    httpClient.post<T>(`/market/${id}/fav`),
  unfav: <T = unknown>(id: string) =>
    httpClient.delete<T>(`/market/${id}/fav`),
}
```

Note: API paths remain `/market/*` — backend route alias rename comes in Task 3. `marketService.ts` is dead code (unused), so no import updates needed.

- [ ] **Step 2: Delete marketService.ts**

Run: `Remove-Item -LiteralPath "apps/tavern/client/src/services/marketService.ts"`

- [ ] **Step 3: Verify no broken imports**

Run: `grep -r "marketService" --include="*.ts" --include="*.tsx" apps/tavern/client/src/`
Expected: No matches (was dead code).

---

### Task 2: Rename backend market.service.ts → card.service.ts + add card route alias

**Files:**
- Rename: `apps/tavern/server/src/services/market.service.ts` → `apps/tavern/server/src/services/card.service.ts`
- Modify: `apps/tavern/server/src/routes/market.ts` → import card.service
- Modify: `apps/tavern/server/src/routes/index.ts` → add card alias mount points

- [ ] **Step 1: Create card.service.ts as a copy of market.service.ts**

Content identical to current `market.service.ts` (all functions stay same, just file rename).

- [ ] **Step 2: Update import in routes/market.ts**

Change line 3:
```typescript
// Before:
import * as marketService from '../services/market.service'
// After:
import * as cardService from '../services/card.service'
```

Update all `marketService.xxx` calls in the file to `cardService.xxx`:
- `marketService.listMarket` → `cardService.listMarket`
- `marketService.getFeatured` → `cardService.getFeatured`
- `marketService.searchMarket` → `cardService.searchMarket`
- `marketService.getTags` → `cardService.getTags`
- `marketService.getMarketCard` → `cardService.getMarketCard`

- [ ] **Step 3: Add card route alias in routes/index.ts**

After each existing market route block, add the cards alias:
```typescript
// After line 38: router.use('/v1/market', marketRoutes);
router.use('/v1/cards', marketRoutes);

// After line 74: router.use('/api/v1/market', marketRoutes);
router.use('/api/v1/cards', marketRoutes);

// After line 91: router.use('/api/tavern/v1/market', marketRoutes);
router.use('/api/tavern/v1/cards', marketRoutes);

// After line 115: router.use('/api/v1/tavern/market', marketRoutes);
router.use('/api/v1/tavern/cards', marketRoutes);
```

- [ ] **Step 4: Delete old market.service.ts**

Run: `Remove-Item -LiteralPath "apps/tavern/server/src/services/market.service.ts"`

- [ ] **Step 5: Verify TypeScript**

Run: `cd apps/tavern/server && npx tsc --noEmit`
Expected: no errors.

---

### Task 3: Backend card-schemes route + service

**Files:**
- Create: `apps/tavern/server/src/services/cardScheme.service.ts`
- Create: `apps/tavern/server/src/routes/cardSchemes.ts`
- Modify: `apps/tavern/server/src/routes/index.ts`

- [ ] **Step 1: Create cardScheme.service.ts**

```typescript
import { success } from '../utils/response'

interface CardScheme {
  id: string
  name: string
  description: string
  tags: string[]
  source: 'official'
  cards: {
    characters: string[]
    mechanics: string[]
    maps: string[]
    backgrounds: string[]
  }
  usageCount: number
  createdAt: number
  updatedAt: number
}

// Hardcoded official schemes — MVP, no DB needed
const OFFICIAL_SCHEMES: CardScheme[] = [
  {
    id: 'scheme_wilderness',
    name: '荒野求生',
    description: '在荒野中生存与探索。适合喜欢生存题材的玩家，包含资源管理、探索发现等核心玩法。',
    tags: ['生存', '冒险', '新手推荐'],
    source: 'official',
    cards: {
      characters: [], // empty — will be populated when official cards exist
      mechanics: [],
      maps: [],
      backgrounds: [],
    },
    usageCount: 0,
    createdAt: 1716969600000,
    updatedAt: 1716969600000,
  },
  {
    id: 'scheme_mystery',
    name: '迷雾疑云',
    description: '破解小镇上接连发生的诡异事件。适合喜欢推理和解谜的玩家。',
    tags: ['推理', '悬疑', '解谜'],
    source: 'official',
    cards: {
      characters: [],
      mechanics: [],
      maps: [],
      backgrounds: [],
    },
    usageCount: 0,
    createdAt: 1716969600000,
    updatedAt: 1716969600000,
  },
  {
    id: 'scheme_kingdom',
    name: '王国纷争',
    description: '在动荡的中世纪王国中崛起。适合喜欢策略、政治和角色扮演的玩家。',
    tags: ['策略', '中世纪', '战争'],
    source: 'official',
    cards: {
      characters: [],
      mechanics: [],
      maps: [],
      backgrounds: [],
    },
    usageCount: 0,
    createdAt: 1716969600000,
    updatedAt: 1716969600000,
  },
]

export async function listSchemes(params: { page?: number; pageSize?: number; tag?: string }) {
  const page = params.page || 1
  const pageSize = params.pageSize || 20
  let filtered = OFFICIAL_SCHEMES
  if (params.tag) {
    filtered = OFFICIAL_SCHEMES.filter(s => s.tags.includes(params.tag!))
  }
  const total = filtered.length
  const skip = (page - 1) * pageSize
  const items = filtered.slice(skip, skip + pageSize)
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getSchemeDetail(id: string): Promise<CardScheme | null> {
  return OFFICIAL_SCHEMES.find(s => s.id === id) || null
}
```

- [ ] **Step 2: Create routes/cardSchemes.ts**

```typescript
import { Router, Request, Response } from 'express'
import * as cardSchemeService from '../services/cardScheme.service'

const router = Router()

// GET /api/v1/card-schemes — list official schemes
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const tag = req.query.tag as string | undefined
    const result = await cardSchemeService.listSchemes({ page, pageSize, tag })
    res.json({ code: 0, message: 'ok', data: result })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

// GET /api/v1/card-schemes/:id — scheme detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const scheme = await cardSchemeService.getSchemeDetail(req.params.id)
    if (!scheme) {
      res.status(404).json({ code: 404, message: '配卡方案不存在', data: null })
      return
    }
    res.json({ code: 0, message: 'ok', data: scheme })
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message, data: null })
  }
})

export default router
```

- [ ] **Step 3: Register in routes/index.ts**

Add import:
```typescript
import cardSchemeRoutes from './cardSchemes'
```

Add mount points after the market routes block. Add in all 4 sections:
```typescript
// Card scheme routes (v1)
router.use('/v1/card-schemes', cardSchemeRoutes);

// Backward-compatible (api/v1)
router.use('/api/v1/card-schemes', cardSchemeRoutes);

// Legacy (api/tavern/v1)
router.use('/api/tavern/v1/card-schemes', cardSchemeRoutes);

// Dev direct (api/v1/tavern)
router.use('/api/v1/tavern/card-schemes', cardSchemeRoutes);
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd apps/tavern/server && npx tsc --noEmit`
Expected: no errors.

---

### Task 4: Extract AI generation utils to shared module

**Files:**
- Create: `apps/tavern/client/src/utils/aiWorldBuilder.ts`
- Modify: `apps/tavern/client/src/pages/game-setup/index.tsx` (remove inline functions, import from utils)

- [ ] **Step 1: Create utils/aiWorldBuilder.ts**

```typescript
import { generateText } from '@/services/aiService'

export interface GenResult {
  worldSetting: { title: string; description: string; rules: string[] }
  groups: Array<{ name: string; memberIds: string[] }>
}

export const RETRY_SYSTEM_PROMPT = '你是一个 JSON 生成器。只输出以下 JSON，不要任何其他文字、解释、代码块。\nJSON 结构：\n{\n  "worldSetting": { "title": "世界观标题", "description": "世界观描述（200字内）", "rules": ["规则1", "规则2", "规则3"] },\n  "groups": [{ "name": "群组名称", "memberIds": ["角色ID"] }]\n}'

export async function generateWithRetry(systemPrompt: string, userMessage: string, model: string): Promise<GenResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? systemPrompt : RETRY_SYSTEM_PROMPT
    const resultText = await generateText({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
      model,
    })
    if (!resultText || !resultText.trim()) {
      if (attempt === 0) { console.warn('[generate] AI 返回空响应，自动重试中...'); continue }
      throw new Error('AI 返回了空响应，请重试')
    }
    try {
      return extractGenResult(resultText)
    } catch (err) {
      if (attempt === 0) {
        console.warn('[generate] JSON 提取失败，自动重试中:', err instanceof Error ? err.message : String(err), '\nAI 响应片段 (前 300 字):', resultText.slice(0, 300))
        continue
      }
      console.error('[generate] 两次尝试均失败，AI 完整响应:', resultText.slice(0, 1000))
      throw err
    }
  }
  throw new Error('AI 响应解析失败，请重试')
}

export function sanitizeJsonCandidate(raw: string): string {
  let result = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/[\uFEFF\uFFFE]/g, '')
    .replace(/\uFFFF/g, '')
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/([{,]\s*)"(\w+)\s+([\[\{])/g, '$1"$2": $3')
  const braceIdx = result.search(/[\{\[]/)
  if (braceIdx > 0) { result = result.slice(braceIdx) }
  return result
}

function isValidGenResult(parsed: unknown): parsed is GenResult {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed as Record<string, unknown>
  if (!('worldSetting' in p) || !('groups' in p)) return false
  if (!Array.isArray(p.groups)) return false
  const ws = p.worldSetting as Record<string, unknown> | null | undefined
  if (!ws || typeof ws.title !== 'string' || typeof ws.description !== 'string') return false
  for (const g of p.groups) {
    const group = g as Record<string, unknown> | null | undefined
    if (!group || typeof group.name !== 'string' || !Array.isArray(group.memberIds)) return false
  }
  return true
}

export function extractGenResult(text: string): GenResult {
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (mdMatch) {
    const candidate = (mdMatch[1] || '').trim()
    try {
      const parsed = JSON.parse(sanitizeJsonCandidate(candidate))
      if (isValidGenResult(parsed)) return parsed
    } catch { /* fall through */ }
  }
  let searchStart = 0
  while (searchStart < text.length) {
    const braceOpen = text.indexOf('{', searchStart)
    if (braceOpen === -1) break
    let depth = 0, braceClose = -1, inString = false, escapeNext = false
    for (let i = braceOpen; i < text.length; i++) {
      const ch = text[i] as string
      if (escapeNext) { escapeNext = false; continue }
      if (ch === '\\') { escapeNext = true; continue }
      if (ch === '"' && !inString) { inString = true; continue }
      if (ch === '"' && inString) { inString = false; continue }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') depth--
      if (depth === 0) { braceClose = i; break }
    }
    if (braceClose === -1) break
    const candidate = text.slice(braceOpen, braceClose + 1)
    try {
      const parsed = JSON.parse(sanitizeJsonCandidate(candidate))
      if (isValidGenResult(parsed)) return parsed
    } catch { /* try next */ }
    searchStart = braceOpen + 1
  }
  console.warn('[extractGenResult] 原始 AI 响应 (前 500 字):', text.slice(0, 500))
  throw new Error('AI 响应中未找到有效的 JSON 结构，请重试')
}

export function buildCardsPromptData(cards: { characters: any[], mechanics: any[], maps: any[], backgrounds: any[] }) {
  return {
    characters: cards.characters.map(c => ({ id: c.id, name: c.name, description: c.description, prompt: c.prompt })),
    mechanics: cards.mechanics.map(c => ({ id: c.id, name: c.name, description: c.description })),
    maps: cards.maps.map(c => ({ id: c.id, name: c.name, description: c.description })),
    backgrounds: cards.backgrounds.map(c => ({ id: c.id, name: c.name, description: c.description })),
  }
}

export const WORLD_BUILDER_SYSTEM_PROMPT = '你是一个游戏世界构建师。基于卡牌组合构建世界观，并将角色分配到群组中。\n\n【重要】只输出纯 JSON，不要任何额外文字、解释、问候语、或 markdown 代码块。\n\nJSON 结构必须严格遵守（不要修改字段名）：\n{\n  "worldSetting": { "title": "世界观标题", "description": "世界观描述（200字内）", "rules": ["规则1", "规则2", "规则3"] },\n  "groups": [{ "name": "群组名称", "memberIds": ["角色ID"] }]\n}\n\n要求：群组 2-4 个，每个角色至少属于一个群组，第一个群组为"世界公告群"包含所有角色。memberIds 必须使用传入的角色 ID 字符串，不要捏造或修改 ID。'
```

- [ ] **Step 2: Update game-setup/index.tsx**

Remove inline functions (GenResult interface, RETRY_SYSTEM_PROMPT, generateWithRetry, sanitizeJsonCandidate, extractGenResult) and import from utils instead.

Add import:
```typescript
import { generateWithRetry, extractGenResult, buildCardsPromptData, WORLD_BUILDER_SYSTEM_PROMPT } from '@/utils/aiWorldBuilder'
```

Replace inline `RETRY_SYSTEM_PROMPT` usage → use named import.
Replace inline `systemPrompt` in handleGenerate → use `WORLD_BUILDER_SYSTEM_PROMPT`.
Replace inline `cardsData` construction → use `buildCardsPromptData(selectedCards)`.

- [ ] **Step 3: Verify TypeScript**

Run: `cd apps/tavern/client && npx tsc --noEmit`
Expected: no errors.

---

### Task 5: Frontend schemeStore (Zustand)

**Files:**
- Create: `apps/tavern/client/src/stores/schemeStore.ts`

- [ ] **Step 1: Create schemeStore.ts**

```typescript
import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { httpClient } from '@/services/httpClient'

export interface CardScheme {
  id: string
  name: string
  description: string
  tags: string[]
  source: 'official' | 'user'
  cards: {
    characters: string[]
    mechanics: string[]
    maps: string[]
    backgrounds: string[]
  }
  usageCount: number
  createdAt: number
  updatedAt: number
}

const USER_SCHEMES_KEY = 'tavern_user_schemes'

function loadUserSchemes(): CardScheme[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(USER_SCHEMES_KEY)
      return data ? JSON.parse(data) : []
    }
    const data = Taro.getStorageSync(USER_SCHEMES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function persistUserSchemes(schemes: CardScheme[]) {
  try {
    const str = JSON.stringify(schemes)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_SCHEMES_KEY, str)
      return
    }
    Taro.setStorageSync(USER_SCHEMES_KEY, str)
  } catch { /* ignore */ }
}

interface SchemeState {
  officialSchemes: CardScheme[]
  userSchemes: CardScheme[]
  loading: boolean
  error: string | null

  fetchOfficialSchemes: () => Promise<void>
  addUserScheme: (scheme: CardScheme) => void
  removeUserScheme: (id: string) => void
  incrementUsage: (id: string) => void
  restoreFromStorage: () => void
}

export const useSchemeStore = create<SchemeState>((set, get) => ({
  officialSchemes: [],
  userSchemes: [],
  loading: false,
  error: null,

  restoreFromStorage: () => {
    set({ userSchemes: loadUserSchemes() })
  },

  fetchOfficialSchemes: async () => {
    set({ loading: true, error: null })
    try {
      const res = await httpClient.get<{ items: CardScheme[] }>('/card-schemes')
      const data = res as any
      const items = data?.data?.items || data?.items || []
      set({ officialSchemes: items, loading: false })
    } catch (err: any) {
      set({ error: err.message || '获取配卡方案失败', loading: false })
    }
  },

  addUserScheme: (scheme) => {
    const newScheme: CardScheme = {
      ...scheme,
      source: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const newSchemes = [newScheme, ...get().userSchemes]
    set({ userSchemes: newSchemes })
    persistUserSchemes(newSchemes)
  },

  removeUserScheme: (id) => {
    const newSchemes = get().userSchemes.filter(s => s.id !== id)
    set({ userSchemes: newSchemes })
    persistUserSchemes(newSchemes)
  },

  incrementUsage: (id) => {
    const update = (schemes: CardScheme[]) =>
      schemes.map(s => s.id === id ? { ...s, usageCount: s.usageCount + 1 } : s)
    set({
      officialSchemes: update(get().officialSchemes),
      userSchemes: update(get().userSchemes),
    })
    persistUserSchemes(update(get().userSchemes))
  },
}))
```

---

### Task 6: SchemeCard component

**Files:**
- Create: `apps/tavern/client/src/components/SchemeCard/index.tsx`
- Create: `apps/tavern/client/src/components/SchemeCard/index.scss`

- [ ] **Step 1: Create SchemeCard/index.tsx**

```tsx
import { View, Text } from '@tarojs/components'
import { Icon } from '@/components'
import type { IconName } from '@/components/Icon'
import type { CardScheme } from '@/stores/schemeStore'
import './index.scss'

interface SchemeCardProps {
  scheme: CardScheme
  onClick?: () => void
}

const TYPE_ICONS: Record<string, IconName> = {
  characters: 'user',
  mechanics: 'settings',
  maps: 'gallery',
  backgrounds: 'photo',
}

const TYPE_LABELS: Record<string, string> = {
  characters: '角色',
  mechanics: '机制',
  maps: '地图',
  backgrounds: '背景',
}

function countNonEmpty(scheme: CardScheme): string {
  const parts: string[] = []
  if (scheme.cards.characters.length > 0) parts.push(`角色 ${scheme.cards.characters.length}`)
  if (scheme.cards.mechanics.length > 0) parts.push(`机制 ${scheme.cards.mechanics.length}`)
  if (scheme.cards.maps.length > 0) parts.push(`地图 ${scheme.cards.maps.length}`)
  if (scheme.cards.backgrounds.length > 0) parts.push(`背景 ${scheme.cards.backgrounds.length}`)
  return parts.join(' · ') || '暂无卡组'
}

export default function SchemeCard({ scheme, onClick }: SchemeCardProps) {
  return (
    <View className='scheme-card' onClick={onClick}>
      <View className='scheme-card-header'>
        <Text className='scheme-card-name'>{scheme.name}</Text>
        {scheme.source === 'official' && (
          <View className='scheme-card-badge'>
            <Text>官方</Text>
          </View>
        )}
      </View>
      <Text className='scheme-card-desc'>{scheme.description}</Text>
      <Text className='scheme-card-types'>{countNonEmpty(scheme)}</Text>
      {scheme.tags.length > 0 && (
        <View className='scheme-card-tags'>
          {scheme.tags.map(tag => (
            <Text key={tag} className='scheme-card-tag'>#{tag}</Text>
          ))}
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 2: Create SchemeCard/index.scss**

```scss
.scheme-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);

  &:active {
    transform: scale(0.97);
    border-color: var(--color-primary-light);
    box-shadow: var(--shadow-md);
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-xs);
  }

  &-name {
    font-size: var(--font-body);
    color: var(--color-text);
    font-weight: var(--font-weight-semibold);
  }

  &-badge {
    background: var(--color-primary);
    border-radius: var(--radius-pill);
    padding: 2rpx var(--spacing-sm);
    font-size: var(--font-caption);
    color: var(--color-text-inverse);
  }

  &-desc {
    font-size: var(--font-body-sm);
    color: var(--color-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: var(--spacing-xs);
    line-height: 1.4;
  }

  &-types {
    font-size: var(--font-caption);
    color: var(--color-text-tertiary);
    margin-bottom: var(--spacing-xs);
  }

  &-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2xs);
  }

  &-tag {
    font-size: var(--font-caption);
    color: var(--color-primary);
  }
}
```

---

### Task 7: Scheme detail page

**Files:**
- Create: `apps/tavern/client/src/pages/scheme-detail/index.tsx`
- Create: `apps/tavern/client/src/pages/scheme-detail/index.scss`
- Modify: `apps/tavern/client/src/app.config.ts` (register new page)

- [ ] **Step 1: Register page in app.config.ts**

Add to pages array:
```typescript
'pages/scheme-detail/index',
```

- [ ] **Step 2: Create scheme-detail/index.tsx**

```tsx
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useSchemeStore, CardScheme } from '@/stores/schemeStore'
import { useSyncedCardsStore } from '@/stores/syncedCardsStore'
import { useLocalCardsStore } from '@/stores/localCardsStore'
import { useGameStore } from '@/stores/gameStore'
import { useChatStore } from '@/stores/chatStore'
import { Icon, ModelSelector } from '@/components'
import { generateWithRetry, buildCardsPromptData, WORLD_BUILDER_SYSTEM_PROMPT } from '@/utils/aiWorldBuilder'
import './index.scss'

export default function SchemeDetailPage() {
  const router = useRouter()
  const schemeId = router.params.id || ''
  const [scheme, setScheme] = useState<CardScheme | null>(null)
  const [saveName, setSaveName] = useState('')
  const [generating, setGenerating] = useState(false)

  const schemeStore = useSchemeStore()
  const syncedStore = useSyncedCardsStore()
  const localStore = useLocalCardsStore()
  const { createSave, updateSaveGroups, enableGameMode, incrementUsage: incrementSaveUsage } = useGameStore()
  const { selectedModel } = useChatStore()

  useEffect(() => {
    // Find scheme from store
    const found = schemeStore.officialSchemes.find(s => s.id === schemeId) ||
      schemeStore.userSchemes.find(s => s.id === schemeId)
    setScheme(found || null)
  }, [schemeId, schemeStore.officialSchemes, schemeStore.userSchemes])

  const handleStart = async () => {
    if (!scheme) return
    setGenerating(true)
    try {
      // Resolve card IDs to full card objects from stores
      const allOfficial = syncedStore.cards
      const allLocal = localStore.cards
      const allCards = [...allOfficial, ...allLocal]

      const resolveCards = (ids: string[]) =>
        ids.map(id => allCards.find(c => c.id === id)).filter(Boolean) as any[]

      const selectedCards = {
        characters: resolveCards(scheme.cards.characters),
        mechanics: resolveCards(scheme.cards.mechanics),
        maps: resolveCards(scheme.cards.maps),
        backgrounds: resolveCards(scheme.cards.backgrounds),
      }

      // Validate at least one card exists
      if (selectedCards.characters.length === 0) {
        Taro.showToast({ title: '该方案暂无可用的卡片', icon: 'none' })
        setGenerating(false)
        return
      }

      const cardsData = buildCardsPromptData(selectedCards)
      const userMessage = `角色卡: ${JSON.stringify(cardsData.characters)}\n机制卡: ${JSON.stringify(cardsData.mechanics)}\n地图卡: ${JSON.stringify(cardsData.maps)}\n背景卡: ${JSON.stringify(cardsData.backgrounds)}`
      const model = selectedModel || 'deepseek-chat'
      const result = await generateWithRetry(WORLD_BUILDER_SYSTEM_PROMPT, userMessage, model)

      const groups = Array.isArray(result.groups) ? result.groups : []
      const save = createSave({
        name: saveName || result.worldSetting.title,
        playerCount: selectedCards.characters.length,
        selectedCards: {
          characters: selectedCards.characters.map(c => c.id),
          mechanics: selectedCards.mechanics.map(c => c.id),
          maps: selectedCards.maps.map(c => c.id),
          backgrounds: selectedCards.backgrounds.map(c => c.id),
        },
        worldSetting: result.worldSetting,
        groups: groups.map((g, i) => ({
          id: 'group_' + Date.now().toString(36) + '_' + i,
          name: g.name || '未命名群组',
          memberIds: Array.isArray(g.memberIds) ? g.memberIds : [],
          isGroup: true as const,
          pinned: i === 0,
          pinnedAt: i === 0 ? Date.now() : undefined,
          updatedAt: Date.now(),
        })),
      })

      updateSaveGroups(save.id, save.groups)
      schemeStore.incrementUsage(scheme.id)
      enableGameMode()
      await Taro.showToast({ title: '世界构建完成!', icon: 'success' })
      Taro.reLaunch({ url: '/pages/chats/index' })
    } catch (err) {
      console.error('[scheme-detail] generate error:', err)
      Taro.showToast({ title: '世界构建失败，请重试', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  if (!scheme) {
    return (
      <View className='scheme-detail'>
        <View className='scheme-detail-empty'>
          <Text>配卡方案不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='scheme-detail'>
      <View className='scheme-detail-header'>
        <View className='scheme-detail-back' onClick={() => Taro.navigateBack()}>
          <Icon name='arrow-left' size={36} color='var(--color-icon-action)' />
        </View>
        <Text className='scheme-detail-title'>配卡方案详情</Text>
      </View>

      <ScrollView scrollY className='scheme-detail-body'>
        <View className='scheme-detail-tags'>
          {scheme.tags.map(tag => (
            <Text key={tag} className='scheme-detail-tag'>#{tag}</Text>
          ))}
          {scheme.source === 'official' && (
            <Text className='scheme-detail-tag scheme-detail-tag--official'>官方推荐</Text>
          )}
        </View>

        <Text className='scheme-detail-name'>{scheme.name}</Text>
        <Text className='scheme-detail-desc'>{scheme.description}</Text>
        {scheme.usageCount > 0 && (
          <Text className='scheme-detail-usage'>已使用 {scheme.usageCount} 次</Text>
        )}

        <View className='scheme-detail-section'>
          <Text className='scheme-detail-section-title'>卡组构成</Text>
          {scheme.cards.characters.length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>角色卡 ({scheme.cards.characters.length})</Text>
            </View>
          )}
          {scheme.cards.mechanics.length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>机制卡 ({scheme.cards.mechanics.length})</Text>
            </View>
          )}
          {scheme.cards.maps.length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>地图卡 ({scheme.cards.maps.length})</Text>
            </View>
          )}
          {scheme.cards.backgrounds.length > 0 && (
            <View className='scheme-detail-card-type'>
              <Text className='scheme-detail-card-type-label'>背景卡 ({scheme.cards.backgrounds.length})</Text>
            </View>
          )}
        </View>

        <View className='scheme-detail-section'>
          <Text className='scheme-detail-section-title'>游戏设置</Text>
          <View className='scheme-detail-setting'>
            <Text className='scheme-detail-setting-label'>存档名称</Text>
            <Input
              className='scheme-detail-setting-input'
              value={saveName}
              onInput={e => setSaveName(e.detail.value)}
              placeholder='留空则使用AI生成的世界观标题'
            />
          </View>
          <View className='scheme-detail-setting'>
            <Text className='scheme-detail-setting-label'>AI 模型</Text>
            <ModelSelector
              compact
              onModelChange={() => Taro.showToast({ title: '已切换模型', icon: 'none', duration: 1000 })}
            />
          </View>
        </View>
      </ScrollView>

      <View className='scheme-detail-bottom'>
        <View
          className={`scheme-detail-start-btn ${generating ? 'scheme-detail-start-btn--loading' : ''}`}
          onClick={generating ? undefined : handleStart}
        >
          <Text>{generating ? 'AI 构建世界中...' : '开始游戏'}</Text>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 3: Create scheme-detail/index.scss**

```scss
.scheme-detail {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);

  &-header {
    display: flex;
    align-items: center;
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
    position: sticky;
    top: 0;
    background: var(--color-bg);
    z-index: 1;
  }

  &-back {
    padding: var(--spacing-xs);
    cursor: pointer;
  }

  &-title {
    font-size: var(--font-body);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
  }

  &-body {
    flex: 1;
    padding: 0 var(--spacing-md) var(--spacing-xl);
  }

  &-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  &-tag {
    font-size: var(--font-caption);
    color: var(--color-text-tertiary);

    &--official {
      color: var(--color-primary);
    }
  }

  &-name {
    font-size: var(--font-heading);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    margin-bottom: var(--spacing-sm);
  }

  &-desc {
    font-size: var(--font-body);
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: var(--spacing-sm);
  }

  &-usage {
    font-size: var(--font-caption);
    color: var(--color-text-tertiary);
    margin-bottom: var(--spacing-lg);
  }

  &-section {
    margin-top: var(--spacing-lg);

    &-title {
      font-size: var(--font-body);
      color: var(--color-text);
      font-weight: var(--font-weight-semibold);
      margin-bottom: var(--spacing-sm);
      display: block;

      &::before {
        content: '─';
        color: var(--color-border);
        margin-right: var(--spacing-xs);
      }
    }
  }

  &-card-type {
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--color-border-subtle);

    &-label {
      font-size: var(--font-body-sm);
      color: var(--color-text-secondary);
    }
  }

  &-setting {
    margin-bottom: var(--spacing-md);

    &-label {
      font-size: var(--font-body-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-xs);
      display: block;
    }

    &-input {
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-body);
      color: var(--color-text);
      height: 72rpx;
    }
  }

  &-bottom {
    padding: var(--spacing-md);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0));
    background: var(--color-bg);
    border-top: 1px solid var(--color-border-subtle);
  }

  &-start-btn {
    width: 100%;
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary);
    border-radius: var(--radius-lg);
    color: var(--color-text-inverse);
    font-size: var(--font-body);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all var(--transition-base);

    &:active {
      opacity: 0.85;
      transform: scale(0.98);
    }

    &--loading {
      opacity: 0.7;
    }
  }

  &-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: var(--color-text-tertiary);
  }
}
```

---

### Task 8: Add 配卡 sub-tab to cards page

**Files:**
- Modify: `apps/tavern/client/src/pages/cards/index.tsx`
- Modify: `apps/tavern/client/src/pages/cards/index.scss`

- [ ] **Step 1: Update cards/index.tsx**

Add import for scheme store and SchemeCard component:
```typescript
import { useSchemeStore } from '@/stores/schemeStore'
import SchemeCard from '@/components/SchemeCard'
```

Add `'scheme'` to `SubTabType`:
```typescript
type SubTabType = 'character' | 'mechanism' | 'map' | 'background' | 'create' | 'scheme'
```

Add to `CARD_TYPE_MAP`:
```typescript
scheme: null,
```

Add to `SUB_TABS`:
```typescript
{ key: 'scheme', label: '配卡', icon: 'sparkle' },
```

Initialize scheme store in component:
```typescript
const schemeStore = useSchemeStore()

// In useDidShow, add:
schemeStore.fetchOfficialSchemes()
```

Add scheme content block after the `create` tab block:
```tsx
{subTab === 'scheme' && (
  <View className='market-sub-panel-content'>
    {schemeStore.loading && <Skeleton type='list' count={4} />}
    {schemeStore.officialSchemes.length > 0 && (
      <>
        <View className='market-section-title'><Text>官方推荐</Text></View>
        <View className='market-scheme-grid'>
          {schemeStore.officialSchemes.map(scheme => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              onClick={() => Taro.navigateTo({ url: `/pages/scheme-detail/index?id=${scheme.id}` })}
            />
          ))}
        </View>
      </>
    )}
    {schemeStore.userSchemes.length > 0 && (
      <>
        <View className='market-section-title'><Text>我的配卡</Text></View>
        <View className='market-scheme-grid'>
          {schemeStore.userSchemes.map(scheme => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              onClick={() => Taro.navigateTo({ url: `/pages/scheme-detail/index?id=${scheme.id}` })}
            />
          ))}
        </View>
      </>
    )}
    {!schemeStore.loading && schemeStore.officialSchemes.length === 0 && schemeStore.userSchemes.length === 0 && (
      <EmptyState icon={<Icon name='sparkle' size={64} color='var(--color-icon-disabled)' />} title='暂无配卡方案' description='官方方案加载中，或稍后再来看看' />
    )}
  </View>
)}
```

- [ ] **Step 2: Add scheme grid style in index.scss**

```scss
.market-scheme-grid {
  padding: 0 var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-base);
}
```

---

### Task 9: Add "保存为配卡方案" button to game-setup

**Files:**
- Modify: `apps/tavern/client/src/pages/game-setup/index.tsx`

- [ ] **Step 1: Add import**

```typescript
import { useSchemeStore } from '@/stores/schemeStore'
```

- [ ] **Step 2: Add store hook in component**

```typescript
const schemeStore = useSchemeStore()
```

- [ ] **Step 3: Add save handler + button in renderConfirm**

Add handler:
```typescript
const handleSaveAsScheme = () => {
  const schemeId = 'user_scheme_' + Date.now().toString(36)
  const scheme = {
    id: schemeId,
    name: saveName || `方案 ${new Date().toLocaleDateString()}`,
    description: `包含 ${selectedCards.characters.length} 张角色卡、${selectedCards.mechanics.length} 张机制卡、${selectedCards.maps.length} 张地图卡、${selectedCards.backgrounds.length} 张背景卡`,
    tags: [] as string[],
    source: 'user' as const,
    cards: {
      characters: selectedCards.characters.map(c => c.id),
      mechanics: selectedCards.mechanics.map(c => c.id),
      maps: selectedCards.maps.map(c => c.id),
      backgrounds: selectedCards.backgrounds.map(c => c.id),
    },
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  schemeStore.addUserScheme(scheme)
  Taro.showToast({ title: '已保存为配卡方案', icon: 'success' })
}
```

Add button after the "开始游戏" button in renderConfirm:
```tsx
<View
  className='game-setup-confirm-btn game-setup-confirm-btn--secondary'
  onClick={handleSaveAsScheme}
>
  <Text>保存为配卡方案</Text>
</View>
```

- [ ] **Step 4: Add secondary button style in game-setup/index.scss**

```scss
.game-setup-confirm-btn--secondary {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-sm);

  &:active {
    background: var(--color-bg-muted);
  }
}
```

---

### Task 10: Verification

- [ ] **Step 1: LSP diagnostics**

Run `lsp_diagnostics` on these directories:
- `apps/tavern/client/src/pages/cards/`
- `apps/tavern/client/src/pages/scheme-detail/`
- `apps/tavern/client/src/stores/`
- `apps/tavern/client/src/utils/`
- `apps/tavern/server/src/routes/`
- `apps/tavern/server/src/services/`

- [ ] **Step 2: TypeScript check**

Run: `cd apps/tavern/client && npx tsc --noEmit`
Run: `cd apps/tavern/server && npx tsc --noEmit`

- [ ] **Step 3: Build check (frontend)**

Run: `cd apps/tavern/client && npm run build:h5`
Expected: Build succeeds.

---

## Plan self-review

**Spec coverage:** All sections covered:
- §2 Data model → Task 5 schemeStore interface
- §3 Entry UI (配卡 tab) → Task 8
- §4 Scheme detail page → Task 7
- §5 One-click flow → Task 7 (handleStart)
- §6 User scheme management → Task 5 + Task 9
- §7 API design → Task 3
- §8 Frontend file list → Tasks 5-8
- §9 market cleanup → Tasks 1-3
- §10 Unaffected scope → intentionally excluded

**Placeholder scan:** No TBD, TODOs, or "fill in later" in the plan above.

**Type consistency:** CardScheme interface used consistently across Tasks 5-9. GenResult and utility functions consistent between Task 4 and Task 7. createSave params match GameSave type.
