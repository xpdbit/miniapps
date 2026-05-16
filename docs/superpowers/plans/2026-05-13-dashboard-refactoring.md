# Dashboard Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split 3 large FTG pages into sub-components, enrich 4 Game1 management pages, and add 2 new Tavern management pages with required backend admin endpoints.

**Architecture:** Pure extraction for FTG pages (zero behavior change), additive enrichment for Game1 pages (keep existing, add on top), server-first development for Tavern (new admin routes → proxy → service → page). All changes scoped to `dashboard/` and `apps/tavern/server/`.

**Tech Stack:** React 19 + TypeScript (strict) + Ant Design + React Query + Express + Prisma

**Path Alias:** `@/*` → `dashboard/src/*`

---

## Scope Boundaries

This plan covers 3 independent subsystems that can be executed in parallel:

| Wave | Subsystem | Scope | Risk |
|------|-----------|-------|------|
| A | FTG page splitting | `dashboard/src/pages/{Achievements,Themes,FoodRecords}/` | Low — pure extraction |
| B | Game1 enrichment | `dashboard/src/pages/Game1{Players,Config,Achievements,Pvp}/` | Medium — new UI + no API changes |
| C | Tavern pages + server | `apps/tavern/server/` + `dashboard/` | High — new server endpoints + proxy + pages |

---

## Part A: FTG Page Splitting

### File Structure After Split

```
dashboard/src/pages/
├── Achievements/
│   ├── index.tsx                      # Thin orchestrator (~50 lines)
│   ├── components/
│   │   ├── AchievementStatsCards.tsx   # Stats overview (3 card row + completion rates + recent unlocks)
│   │   ├── AchievementTable.tsx        # Achievement definition table with columns
│   │   ├── AchievementEditModal.tsx    # Edit achievement modal (icon/description/target/theme)
│   │   ├── UnlockedUsersDrawer.tsx     # Users drawer with achievement summary + user list
│   │   └── ManualTriggerModal.tsx      # Manual detect modal (OpenID + achievement selector)
├── Themes/
│   ├── index.tsx                      # Thin orchestrator (~50 lines)
│   ├── components/
│   │   ├── ThemeCard.tsx              # Single theme card (cover/actions/meta) + card grid render
│   │   ├── ThemeEditDrawer.tsx        # Full edit drawer (basic info + template + CSS classes + JSON config)
│   │   └── ThemePreviewModal.tsx       # iframe preview modal
├── FoodRecords/
│   ├── index.tsx                      # Thin orchestrator (~50 lines)
│   ├── components/
│   │   ├── FilterBar.tsx              # Search + food type + theme + date range + deleted + reset
│   │   ├── RecordsTable.tsx           # Data table with columns + row selection + batch actions
│   │   └── RecordDetailDrawer.tsx     # Full detail drawer (images/basic info/AI desc/nutrition/location/check-ins)
```

### What Goes Into Each Sub-Component File

**Achievements:**

| File | Extracted Lines | Responsibility | Props |
|------|----------------|----------------|-------|
| `AchievementStatsCards` | 366-527 | 3 stat cards (total/unlocked/rate) + individual Progress bars + RecentUnlocks List | `stats, achievementRates, recentUnlocks, loading` |
| `AchievementTable` | 252-343, 529-573 | Column definitions + Table with dataSource | `achievements, loading, onEdit, onViewUsers, onManualTrigger` |
| `AchievementEditModal` | 575-700 | Modal with Form (icon picker, name, desc, conditionType, targetValue, themeId) + Descriptions read-only | `open, editingAchievement, onOk, onCancel, loading` |
| `UnlockedUsersDrawer` | 702-808 | Drawer with achievement Card summary + paginated user List | `open, achievement, users, total, page, onPageChange, onClose` |
| `ManualTriggerModal` | 810-893 | Modal with OpenID input + achievement Select + Popconfirm | `open, achievements, onOk, onCancel` |

**Themes:**

| File | Extracted Lines | Responsibility | Props |
|------|----------------|----------------|-------|
| `ThemeCard` | 391-516 | Card with cover image, action buttons (up/down/edit/toggle/delete), meta info | `theme, index, total, onMoveUp, onMoveDown, onEdit, onToggle, onDelete` |
| `ThemeEditDrawer` | 567-757 | Drawer with Form (name/desc/shortName/gameName/previewImage/status) + template TextArea + variable insertion buttons + CSS class Select + old JSON Collapse | `open, editingTheme, onClose, onSave, classes` |
| `ThemePreviewModal` | 759-786 | Modal with iframe srcDoc rendering | `open, html, onClose` |

**FoodRecords:**

| File | Extracted Lines | Responsibility | Props |
|------|----------------|----------------|-------|
| `FilterBar` | 589-669 | Card with Input.Search, Select (food type + theme), DatePicker.RangePicker, Checkbox (deleted), ResetButton | `filters, onFilterChange, onReset, themeOptions, loading` |
| `RecordsTable` | 202-357, 671-693 | Table with columns definition + pagination + rowSelection | `dataSource, total, loading, page, pageSize, onPageChange, selectedRowKeys, onSelectChange, onViewDetail` |
| `RecordDetailDrawer` | 359-560, 695-717 | Drawer with 6 Card sections (images, basic info, AI desc, nutrition, location, check-in records) | `open, record, onClose, loading` |

### Strategy for Part A (Pure Extraction)

1. Create the `components/` directory for each page
2. Copy-paste each logical section into its own file, preserving every line
3. Wrap each section as a default-exported function component with explicit props interface
4. The main `index.tsx` imports all sub-components and passes the relevant state slices as props
5. **Zero behavior change** verified via git diff after move

---

## Part B: Game1 Page Enrichment

### Game1Players (85 → ~300 lines)

**Current:** Simple table (openId/nickname/stats/status/createdAt) + search + pagination + soft delete + 4 stat cards

**Enrichment target:**
- **Detail Drawer** — click row to open Drawer with full player info (progress, team, inventory summary, recent activity)
- **More columns** — `lastLoginAt`, `totalPlayTime`, `level`, `vipLevel`, `achievementCount`
- **Batch operations** — batch soft delete via selection
- **Export** — export visible rows as JSON/CSV

**No new API needed** — game1-server `/admin/players` returns full player objects, but current page only renders subset. The response likely has more fields. Verify response shape first.

Add sub-components:
- `components/PlayerStatsCards.tsx` (extract from existing)
- `components/PlayerTable.tsx` (extract + enhance columns)
- `components/PlayerDetailDrawer.tsx` (new)

### Game1Config (146 → ~250 lines)

**Current:** Table of config keys + Edit modal with TextArea

**Enrichment target:**
- **Config diff** — show previous value when editing
- **Search/filter** — filter by key name
- **Bulk import** — paste JSON to bulk update
- **Config description tooltip** — show env description on hover

**No new API needed** — game1ConfigApi has `listKeys`, `getValue`, `updateConfig`.

Add sub-components:
- `components/ConfigTable.tsx` (extract + enhance)
- `components/ConfigEditModal.tsx` (extract + add diff view)
- `components/ConfigImportDrawer.tsx` (new)

### Game1Achievements (101 → ~250 lines)

**Current:** Table + 3 stat cards (total/avgUnlockRate/totalUnlocked)

**Enrichment target:**
- **Edit modal** — enable editing achievement config (name, description, icon, condition)
- **Player progress** — click row to see which players have unlocked this achievement
- **Trigger achievement** — manual trigger for testing

**No new API needed** — game1-server admin routes may need verification. Check if PUT `/admin/achievements/:id` exists.

Add sub-components:
- `components/AchievementStats.tsx` (extract)
- `components/AchievementTable.tsx` (extract + add action column)
- `components/AchievementEditModal.tsx` (new)
- `components/UnlockHistoryDrawer.tsx` (new)

### Game1Pvp (110 → ~250 lines)

**Current:** Ranked leaderboard table + 3 stat cards (total/active/avgScore)

**Enrichment target:**
- **Match history** — click row to see recent PVP matches for that player
- **Season selector** — filter by season
- **Distribution chart** — simple bar chart of rank distribution

**No new API needed** — game1-server may have match history endpoint. Check `/admin/pvp/matches/:playerId`. Otherwise skip chart.

Add sub-components:
- `components/PvpStatsCards.tsx` (extract)
- `components/LeaderboardTable.tsx` (extract + add action column)
- `components/MatchHistoryDrawer.tsx` (new)

---

## Part C: Tavern Pages + Server Endpoints

### C1: New Tavern Server Admin Endpoints

New routes to add in `apps/tavern/server/src/routes/admin.ts`:

| Method | Path | Service Function | Description |
|--------|------|-----------------|-------------|
| GET | `/admin/characters` | `moderationService.getAllCharacters` | List ALL characters with status/creator/date filtering |
| GET | `/admin/characters/:id` | `moderationService.getCharacterDetail` | Full character detail with moderation logs |
| GET | `/admin/chats` | `contextService.getAllSessions` | List ALL chat sessions across users |
| GET | `/admin/chats/:id` | `contextService.getSessionAdmin` | Session detail with ALL messages (admin override) |
| GET | `/admin/keys` | `keyService.listAllKeys` | List ALL API keys across users |

New service functions to add:

**In `moderation.service.ts`:**
```typescript
export async function getAllCharacters(page = 1, pageSize = 20, status?: string) {
  const where: Prisma.CharacterCardWhereInput = {}
  if (status && status !== 'all') where.status = status as CardStatus
  const [items, total] = await Promise.all([
    prisma.characterCard.findMany({
      where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: { creator: { select: { id: true, nickname: true } } },
    }),
    prisma.characterCard.count({ where }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getCharacterDetail(id: string) {
  const card = await prisma.characterCard.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, nickname: true, avatar: true } },
      moderationLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
  return card
}
```

**In `context.service.ts`:**
```typescript
export async function getAllSessions(page = 1, pageSize = 20, characterId?: string) {
  const where: Prisma.ChatSessionWhereInput = {}
  if (characterId) where.characterId = characterId
  const [items, total] = await Promise.all([
    prisma.chatSession.findMany({
      where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        user: { select: { id: true, nickname: true } },
        character: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.chatSession.count({ where }),
  ])
  return { items, total, page, pageSize, hasMore: skip + items.length < total }
}

export async function getSessionAdmin(sessionId: string) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { id: true, nickname: true } },
      character: { select: { id: true, name: true, avatar: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  return session
}
```

**In `key.service.ts`:**
```typescript
export async function listAllKeys(page = 1, pageSize = 50) {
  const [items, total] = await Promise.all([
    prisma.apiKey.findMany({
      skip: (page - 1) * pageSize, take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, nickname: true } } },
    }),
    prisma.apiKey.count(),
  ])
  return { items, total, page, pageSize }
}
```

### C2: Enhanced Existing Tavern Page (163 → split)

Current `Tavern/index.tsx` is 163 lines — it's a good candidate for splitting into:

```
Tavern/
├── index.tsx              # Orchestrator with stats + routing
├── components/
│   ├── CharacterTable.tsx # Character list table with actions
│   ├── StatsCards.tsx     # 4 stat cards (total/pending/active/chatCount)
│   └── BanModal.tsx       # Ban confirmation with reason input
```

### C3: New TavernChats Page

```
TavernChats/
├── index.tsx              # Chat session monitoring page
├── components/
│   ├── ChatSessionTable.tsx  # All sessions list with user/character/date/messageCount
│   └── ChatSessionDrawer.tsx # Session detail with messages viewer
```

### C4: New TavernKeys Page

```
TavernKeys/
├── index.tsx              # API Key management page
└── components/
    └── ApiKeyTable.tsx    # All keys list with user/provider/status/date
```

### C5: Add new Dashboard service methods

In `dashboard/src/services/tavern/index.ts`, add:

```typescript
/** Get all characters (admin view) */
getAllCharacters: (params?: { page?: number; pageSize?: number; status?: string }) =>
  adminApiClient.get<PaginatedResponse<TavernCharacterDetail>>('/admin/tavern/characters', { params }),

/** Get character detail */
getCharacterDetail: (id: string) =>
  adminApiClient.get<TavernCharacterDetail>(`/admin/tavern/characters/${id}`),

/** Get all chat sessions */
getAllChatSessions: (params?: { page?: number; pageSize?: number; characterId?: string }) =>
  adminApiClient.get<PaginatedResponse<ChatSession>>('/admin/tavern/chats', { params }),

/** Get chat session detail */
getChatSessionDetail: (id: string) =>
  adminApiClient.get<ChatSessionDetail>(`/admin/tavern/chats/${id}`),

/** Get all API keys */
getAllApiKeys: (params?: { page?: number; pageSize?: number }) =>
  adminApiClient.get<PaginatedResponse<ApiKey>>('/admin/tavern/keys', { params }),
```

New types needed in the same file:
```typescript
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ChatSession {
  id: string
  user: { id: string; nickname: string }
  character: { id: string; name: string; avatar?: string }
  title: string
  messageCount: number
  tokenCount: number
  updatedAt: string
}

export interface ChatSessionDetail extends ChatSession {
  messages: Array<{
    id: string
    role: string
    content: string
    tokens?: number
    createdAt: string
  }>
}

export interface ApiKey {
  id: string
  provider: string
  isActive: boolean
  createdAt: string
  user: { id: string; nickname: string }
}
```

### C6: Registration Changes

**dashboard/src/constants/routes.ts:**
```typescript
ROUTES.TAVERN_CHATS: '/tavern/chats'
ROUTES.TAVERN_KEYS: '/tavern/keys'
```
Add to MENU_ITEMS:
```typescript
{ path: ROUTES.TAVERN_CHATS, scope: 'tavern', label: '聊天记录' },
{ path: ROUTES.TAVERN_KEYS, scope: 'tavern', label: 'API 密钥' },
```
Update PROJECT_FALLBACK:
```typescript
tavern: ROUTES.TAVERN_CHATS, // or keep TAVERN as primary
```

**dashboard/src/constants/permissions.ts:**
```typescript
PERMISSIONS.TAVERN_CHATS: 'tavern_chats'
PERMISSIONS.TAVERN_KEYS: 'tavern_keys'
```
Add to ROLE_PERMISSIONS.admin.
Add to ROUTE_PERMISSION_MAP:
```typescript
'/tavern/chats': PERMISSIONS.TAVERN_CHATS
'/tavern/keys': PERMISSIONS.TAVERN_KEYS
```

**dashboard/src/App.tsx:**
Add 2 new lazy imports + 2 new Route entries under the Layout route.

---

## Execution Plan

### Wave 0: Prerequisites (single-threaded, 5 min)

- [ ] **Read current page files** — Read all 3 FTG pages, 4 Game1 pages, 1 Tavern page in full
- [ ] **Verify Game1 API response shapes** — Check what fields game1-server actually returns for players/achievements/PVP
- [ ] **Verify Game1 game1-server admin routes** — Check if PUT `/admin/achievements/:id` exists in Game1 server

### Wave A: FTG Page Splitting (parallel per page, ~30 min each)

Each of the 3 FTG pages follows the same pattern. They can run in parallel subagents:

#### A1: Achievements Page Split (898 lines)

- [ ] **Create directory** — `dashboard/src/pages/Achievements/components/`
- [ ] **Extract AchievementStatsCards.tsx** — lines 366-527, wrap as default export component with `{ stats, achievementRates, recentUnlocks, loading }` props
- [ ] **Extract AchievementTable.tsx** — lines 252-343 + 529-573, wrap as default export with `{ achievements, loading, onEdit, onViewUsers, onManualTrigger }` props
- [ ] **Extract AchievementEditModal.tsx** — lines 575-700, wrap as default export with `{ open, editingAchievement, onOk, onCancel, loading }` props
- [ ] **Extract UnlockedUsersDrawer.tsx** — lines 702-808, wrap as default export with `{ open, achievement, users, total, page, onPageChange, onClose }` props
- [ ] **Extract ManualTriggerModal.tsx** — lines 810-893, wrap as default export with `{ open, achievements, onOk, onCancel }` props
- [ ] **Rewrite index.tsx** — ~50 lines, import all components, thread state/props
- [ ] **Verify** — `npm run type-check` passes in dashboard, verify no unexpected changes via git diff

#### A2: Themes Page Split (791 lines)

- [ ] **Create directory** — `dashboard/src/pages/Themes/components/`
- [ ] **Extract ThemeCard.tsx** — lines 391-516 into component
- [ ] **Extract ThemeEditDrawer.tsx** — lines 567-757 into component
- [ ] **Extract ThemePreviewModal.tsx** — lines 759-786 into component
- [ ] **Rewrite index.tsx** — import all components
- [ ] **Verify** — `npm run type-check` passes

#### A3: FoodRecords Page Split (722 lines)

- [ ] **Create directory** — `dashboard/src/pages/FoodRecords/components/`
- [ ] **Extract FilterBar.tsx** — lines 589-669 into component
- [ ] **Extract RecordsTable.tsx** — lines 202-357 + 671-693 into component
- [ ] **Extract RecordDetailDrawer.tsx** — lines 359-560 + 695-717 into component
- [ ] **Rewrite index.tsx** — import all components
- [ ] **Verify** — `npm run type-check` passes

### Wave B: Game1 Enrichment (parallel per page, ~20 min each)

#### B1: Game1Players Enrichment (85 → ~300 lines)

- [ ] **Create directory** — `dashboard/src/pages/Game1Players/components/`
- [ ] **Extract PlayerStatsCards.tsx** — from existing index.tsx stat cards
- [ ] **Extract PlayerTable.tsx** — from existing, add columns: `lastLoginAt`, `totalPlayTime`, `level`, `vipLevel`, `achievementCount`
- [ ] **Create PlayerDetailDrawer.tsx** — Drawer with full player info + recent activity
- [ ] **Add batch delete** — rowSelection + batch softDelete mutation
- [ ] **Rewrite index.tsx** — import all components
- [ ] **Verify** — `npm run type-check` passes

#### B2: Game1Config Enrichment (146 → ~250 lines)

- [ ] **Create directory** — `dashboard/src/pages/Game1Config/components/`
- [ ] **Extract ConfigTable.tsx** — add search/filter by key name
- [ ] **Extract ConfigEditModal.tsx** — add previous value display (diff)
- [ ] **Create ConfigImportDrawer.tsx** — JSON paste + bulk update
- [ ] **Rewrite index.tsx**
- [ ] **Verify** — `npm run type-check` passes

#### B3: Game1Achievements Enrichment (101 → ~250 lines)

- [ ] **Create directory** — `dashboard/src/pages/Game1Achievements/components/`
- [ ] **Extract AchievementStats.tsx** — from existing stat cards
- [ ] **Extract AchievementTable.tsx** — add action column (edit, view players)
- [ ] **Create AchievementEditModal.tsx** — Form with name/desc/icon/condition fields
- [ ] **Create UnlockHistoryDrawer.tsx** — List of players who unlocked this achievement
- [ ] **Rewrite index.tsx**
- [ ] **Verify** — `npm run type-check` passes

#### B4: Game1Pvp Enrichment (110 → ~250 lines)

- [ ] **Create directory** — `dashboard/src/pages/Game1Pvp/components/`
- [ ] **Extract PvpStatsCards.tsx** — from existing stat cards
- [ ] **Extract LeaderboardTable.tsx** — add action column (view matches)
- [ ] **Create MatchHistoryDrawer.tsx** — list of recent matches for selected player
- [ ] **Add season filter** — Select component for season filtering
- [ ] **Rewrite index.tsx**
- [ ] **Verify** — `npm run type-check` passes

### Wave C: Tavern Pages + Server (sequential, server first, ~60 min total)

#### C1: Tavern Server — New Admin Route Endpoints

- [ ] **Add `getAllCharacters` to `moderation.service.ts`** — list all characters with status filter
- [ ] **Add `getCharacterDetail` to `moderation.service.ts`** — full character with logs
- [ ] **Add `getAllSessions` to `context.service.ts`** — list all chat sessions
- [ ] **Add `getSessionAdmin` to `context.service.ts`** — session detail with all messages (no userId filter)
- [ ] **Add `listAllKeys` to `key.service.ts`** — list all API keys with user info
- [ ] **Add routes to `admin.ts`** — 5 new GET routes matching above functions
- [ ] **Verify** — `npm run type-check` passes in tavern-server

#### C2: Dashboard — Tavern Service Updates

- [ ] **Add new types and methods to `dashboard/src/services/tavern/index.ts`** — 5 new API methods for characters/chats/keys admin endpoints
- [ ] **Verify** — `npm run type-check` passes in dashboard

#### C3: Dashboard — Enhance Existing Tavern Page

- [ ] **Create `Tavern/components/` directory**
- [ ] **Extract `StatsCards.tsx`** — 4 stat cards from existing page
- [ ] **Extract `CharacterTable.tsx`** — character table with status/actions/fallback logic
- [ ] **Extract `BanModal.tsx`** — ban dialog with reason input
- [ ] **Rewrite `Tavern/index.tsx`** — import sub-components, keep dual-API fallback

#### C4: Dashboard — New TavernChats Page

- [ ] **Create `dashboard/src/pages/TavernChats/` directory**
- [ ] **Create `TavernChats/index.tsx`** — orchestrator page with PageHeader + PageSkeleton
- [ ] **Create `TavernChats/components/ChatSessionTable.tsx`** — Table listing all sessions: user nickname, character name, message count, token count, updatedAt. Click row opens drawer.
- [ ] **Create `TavernChats/components/ChatSessionDrawer.tsx`** — Drawer showing full message history as chat bubbles (user vs character), each message with content + tokens + timestamp

#### C5: Dashboard — New TavernKeys Page

- [ ] **Create `dashboard/src/pages/TavernKeys/` directory**
- [ ] **Create `TavernKeys/index.tsx`** — orchestrator page
- [ ] **Create `TavernKeys/components/ApiKeyTable.tsx`** — Table listing all keys: user nickname, provider, isActive badge, createdAt. No edit/delete needed (read-only for security).

#### C6: Dashboard — Register New Pages

- [ ] **Update `src/constants/routes.ts`** — Add `TAVERN_CHATS` and `TAVERN_KEYS` route constants + menu items
- [ ] **Update `src/constants/permissions.ts`** — Add `TAVERN_CHATS` and `TAVERN_KEYS` permissions
- [ ] **Update `src/App.tsx`** — Add route entries for both new pages under Layout

#### C7: Final Verification

- [ ] **Run `npm run type-check` in dashboard** — verify no type errors
- [ ] **Run `npm run type-check` in tavern-server** — verify no type errors
- [ ] **Run `npm run build` in dashboard** — verify production build succeeds

---

## Commit Strategy

Each wave produces independent, reviewable commits:

```
# Wave A — FTG splitting (3 commits)
commit 1: "refactor(dashboard): split Achievements page into 5 sub-components"
commit 2: "refactor(dashboard): split Themes page into 3 sub-components"
commit 3: "refactor(dashboard): split FoodRecords page into 3 sub-components"

# Wave B — Game1 enrichment (4 commits)
commit 4: "feat(dashboard): enrich Game1Players with detail drawer and batch ops"
commit 5: "feat(dashboard): enrich Game1Config with diff view and bulk import"
commit 6: "feat(dashboard): enrich Game1Achievements with edit modal and unlock history"
commit 7: "feat(dashboard): enrich Game1Pvp with match history and season filter"

# Wave C — Tavern (3 commits)
commit 8: "feat(tavern-server): add admin endpoints for characters/chats/keys"
commit 9: "feat(dashboard): enhance tavern page and add Chats/Keys management pages"
commit 10: "feat(dashboard): register new tavern routes and permissions"
```

---

## Verification Steps

### Per-Component Verification
- `npm run type-check` in dashboard directory — must pass with zero errors
- For each extracted file: verify git diff shows no logic changes (only imports/exports changed)
- For each enriched page: existing stat cards and tables must still render identically

### Full Integration Verification
- `npm run type-check` in tavern-server — must pass
- `npm run build` in dashboard — must succeed
- Manual sanity: each page loads without runtime errors
- No `any` type additions (dashboard has `no-explicit-any: error`)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Copy-paste errors in extraction | Use incremental git add per extracted file; diff each before commit |
| Missing props in sub-components | `tsc --noEmit` catches all missing props since dashboard uses strict mode |
| Game1 API doesn't return expected fields | Pre-read game1-server routes to confirm response shapes |
| Tavern proxy doesn't forward new routes | Tavern proxy is generic (`router.use('/tavern', ...)`) — any `/admin/chats` path works automatically |
| Duplicate import issue in index.tsx | Keep original imports for types/APIs in index.tsx; sub-components import only React/Antd |
