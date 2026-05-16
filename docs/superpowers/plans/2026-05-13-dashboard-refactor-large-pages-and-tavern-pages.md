# Dashboard Refactor: Split Large Pages + Add Tavern Sub-pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 3 oversized pages (Achievements 898 lines, Themes 791 lines, FoodRecords 722 lines) into focused subcomponents, and create 3 new Tavern sub-pages (Characters, Chats, Keys) with full routing/permissions.

**Architecture:** Each page extraction creates a `components/` subdirectory under the page folder, following the existing pattern. The refactored `index.tsx` becomes a composition layer. Tavern new pages mirror the Game1 page pattern (lightweight, single-responsibility). Routing and permissions follow the established `ROUTES` + `PERMISSIONS` + `Sidebar.tsx` + `App.tsx` 4-step registration pattern.

**Tech Stack:** React 19 + TypeScript (strict, `verbatimModuleSyntax`), Ant Design 5, @tanstack/react-query, Zustand

---

## Task Dependency Graph

| Task | Depends On | Reason |
|------|------------|--------|
| T1: Split Achievements | None | Self-contained page refactor |
| T2: Split Themes | None | Self-contained page refactor |
| T3: Split FoodRecords | None | Self-contained page refactor |
| T4: Update routing infra | None | Can be done independently; add route constants/permissions/icons |
| T5: Create TavernCharacters | None | New page, no deps |
| T6: Create TavernChats | None | New page, no deps |
| T7: Create TavernKeys | None | New page, no deps |
| T8: Refactor Tavern index as overview | T4, T5, T6, T7 | Needs route constants + sub-page files to exist for linking |
| T9: Type-check + fix | T1–T8 | All files must exist for compilation |
| T10: Update state/approved_queue | T9 | Non-code task, after all done |

## Parallel Execution Graph

**Wave 1** (Start immediately — all independent):
```
├── T1: Split Achievements page into 5 subcomponents
├── T2: Split Themes page into 3 subcomponents
├── T3: Split FoodRecords page into 3 subcomponents
├── T4: Add routing infrastructure (routes + permissions + icons)
├── T5: Create TavernCharacters page
├── T6: Create TavernChats page
├── T7: Create TavernKeys page
```

**Wave 2** (After Wave 1 completes):
```
└── T8: Refactor Tavern/index.tsx as overview hub
```

**Wave 3** (After Wave 2):
```
├── T9: Run type-check and fix any errors
└── T10: Update state/approved_queue.yaml
```

**Critical Path:** T4+T5+T6+T7 → T8 → T9
**Estimated Speedup:** ~4x over sequential (7 tasks parallel in Wave 1)

---

## Tasks

### Task 1: Split Achievements Page (898 lines → index + 5 components + constants.ts)

**Delegation Recommendation:**
- Category: `deep` - Requires careful extraction of coupled state/logic from large component into clean subcomponents; must understand full lifecycle before refactoring
- Skills: `[]` - Standard TypeScript/React refactoring, no specialized skill needed

**Skills Evaluation:**
- ❌ OMITTED all skills: This is a pure extraction/refactoring task with no AI-slops, no debugging, no creative design needed

**Description:** Extract 5 subcomponents from `src/pages/Achievements/index.tsx`. The file already has a `constants.ts` with shared utilities (`CONDITION_TYPE_MAP`, `maskOpenId`, etc.) — keep that file as-is. Create `components/` directory with focused files.

**Depends On:** None
**Acceptance Criteria:** Achievements/index.tsx compiles and renders identically; no state/behavior regression; all subcomponents are independently importable

**Files:**
- Create: `src/pages/Achievements/components/AchievementStatsSection.tsx`
- Create: `src/pages/Achievements/components/AchievementTable.tsx`
- Create: `src/pages/Achievements/components/EditAchievementModal.tsx`
- Create: `src/pages/Achievements/components/UnlockedUsersDrawer.tsx`
- Create: `src/pages/Achievements/components/TriggerCheckModal.tsx`
- Modify: `src/pages/Achievements/index.tsx` (recompose using subcomponents)

**Steps:**

- [ ] **Step 1: Create `/components` directory and barrel export**

```typescript
// src/pages/Achievements/components/index.ts
export { default as AchievementStatsSection } from './AchievementStatsSection'
export { default as AchievementTable } from './AchievementTable'
export { default as EditAchievementModal } from './EditAchievementModal'
export { default as UnlockedUsersDrawer } from './UnlockedUsersDrawer'
export { default as TriggerCheckModal } from './TriggerCheckModal'
```

Then in the parent `src/pages/Achievements/`, add/index an `index.ts` barrel:
```typescript
export { default } from './index.tsx'
```

- [ ] **Step 2: Create `AchievementStatsSection.tsx`**

Props interface:
```typescript
interface AchievementStatsSectionProps {
  stats: AchievementStats | undefined
  statsLoading: boolean
  statsError: boolean
  onRefresh: () => void
  getProgressColor: (rate: number) => string
}
```

Extract lines 367-527 from the original file. Logically this is the `<Spin spinning={statsLoading}>` block including:
- Error alert for stats (lines 367-383)
- Overview cards (total users / unlocked users / unlock rate) — lines 390-424
- Achievement rates card with progress bars — lines 427-473
- Recent unlocks list — lines 475-517
- Empty state fallback — lines 522-526

Import from `@/services/achievementApi` for types, `@/pages/Achievements/constants` for `maskOpenId`.

- [ ] **Step 3: Create `AchievementTable.tsx`**

Props interface:
```typescript
interface AchievementTableProps {
  achievements: Achievement[] | undefined
  loading: boolean
  error: boolean
  onRefresh: () => void
  onEdit: (achievement: Achievement) => void
  onViewUsers: (achievement: Achievement) => void
}
```

Extract lines 529-573. This is the "成就定义" Card containing:
- Error alert
- Loading skeleton (PageSkeleton type="table")
- Table component with columns definition (lines 253-343)
- Note: The `getConditionTypeConfig` and `getConditionValueLabel` are imported from `@/pages/Achievements/constants`
- The `columns` definition uses `handleOpenEdit`/`handleViewUsers` — these become props callbacks

- [ ] **Step 4: Create `EditAchievementModal.tsx`**

Props interface:
```typescript
interface EditAchievementModalProps {
  open: boolean
  editingAchievement: Achievement | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: AchievementUpdateData) => void
}
```

Extract lines 575-700. A Modal component containing:
- Form with icon/description/conditionValue/themeId fields
- Read-only descriptions header
- Alert info footer
- The form is self-contained with its own Form.useForm() instance
- Import `getConditionTypeConfig` from constants

- [ ] **Step 5: Create `UnlockedUsersDrawer.tsx`**

Props interface:
```typescript
interface UnlockedUsersDrawerProps {
  open: boolean
  viewingAchievement: Achievement | null
  unlockedUsers: UnlockedUser[] | undefined
  usersLoading: boolean
  onClose: () => void
}
```

Extract lines 702-808. A Drawer containing:
- Achievement summary card
- User list (paginated)
- Loading spin state
- Uses `getConditionTypeConfig`, `maskOpenId` from constants
- Uses `useMobile` hook

- [ ] **Step 6: Create `TriggerCheckModal.tsx`**

Props interface:
```typescript
interface TriggerCheckModalProps {
  open: boolean
  achievements: Achievement[] | undefined
  achievementsLoading: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (values: { userOpenId: string; achievementId?: string }) => void
}
```

Extract lines 810-893. A Modal containing:
- Form with userOpenId and achievementId Select (from achievements list)
- Popconfirm for confirmation before execution
- Success alert after submit

- [ ] **Step 7: Refactor `Achievements/index.tsx`**

Keep the state management (useState hooks, useQuery hooks for stats/achievements), mutations, and handler callbacks. Remove all JSX blocks that were extracted. Compose the 5 subcomponents:

```typescript
// File: src/pages/Achievements/index.tsx
// Keep: imports, state, query hooks, mutations, handlers
// Remove: constants.ts content (already separate), JSX blocks

return (
  <div>
    <PageHeader ... />
    <AchievementStatsSection
      stats={stats}
      statsLoading={statsLoading}
      statsError={statsError}
      onRefresh={() => queryClient.invalidateQueries(...)}
      getProgressColor={getProgressColor}
    />
    <AchievementTable
      achievements={achievementsRes}
      loading={achievementsLoading}
      error={achievementsError}
      onRefresh={() => queryClient.invalidateQueries(...)}
      onEdit={handleOpenEdit}
      onViewUsers={handleViewUsers}
    />
    <EditAchievementModal
      open={editModalOpen}
      editingAchievement={editingAchievement}
      submitting={updateMutation.isPending}
      onClose={() => { setEditModalOpen(false); setEditingAchievement(null) }}
      onSubmit={(data) => updateMutation.mutate({ id: editingAchievement!.id, data })}
    />
    <UnlockedUsersDrawer
      open={usersDrawerOpen}
      viewingAchievement={viewingAchievement}
      unlockedUsers={unlockedUsers}
      usersLoading={usersLoading}
      onClose={handleCloseUsersDrawer}
    />
    <TriggerCheckModal
      open={triggerModalOpen}
      achievements={achievementsRes ?? []}
      achievementsLoading={achievementsLoading}
      submitting={triggerMutation.isPending}
      onClose={() => { setTriggerModalOpen(false); triggerForm.resetFields() }}
      onSubmit={(values) => triggerMutation.mutate({ ... })}
    />
  </div>
)
```

---

### Task 2: Split Themes Page (791 lines → index + 3 components)

**Delegation Recommendation:**
- Category: `deep` - Large extraction with template editor state and preview API integration; need careful boundary analysis
- Skills: `[]` - Standard refactoring

**Skills Evaluation:**
- ❌ OMITTED all skills: Pure refactoring task

**Depends On:** None

**Description:** Extract 3 subcomponents from `src/pages/Themes/index.tsx`. The constants (`DEFAULT_TEMPLATE_MARKUP`, `VARIABLE_LIST`, `PREVIEW_MOCK_DATA`, `DEFAULT_CONFIG`) stay in index.tsx or move to a `constants.ts` file.

**Acceptance Criteria:** Themes/index.tsx compiles and renders identically; ThemeCardGrid renders sortable cards; ThemeFormDrawer includes full form + template editor + config; ThemePreviewModal shows iframe preview

**Files:**
- Create: `src/pages/Themes/components/ThemeCardGrid.tsx`
- Create: `src/pages/Themes/components/ThemeFormDrawer.tsx`
- Create: `src/pages/Themes/components/ThemePreviewModal.tsx`
- Create: `src/pages/Themes/components/index.ts` (barrel export)
- Modify: `src/pages/Themes/index.tsx`

- [ ] **Step 1: Create barrel export**

```typescript
// src/pages/Themes/components/index.ts
export { default as ThemeCardGrid } from './ThemeCardGrid'
export { default as ThemeFormDrawer } from './ThemeFormDrawer'
export { default as ThemePreviewModal } from './ThemePreviewModal'
```

- [ ] **Step 2: Create `ThemeCardGrid.tsx`**

Props:
```typescript
interface ThemeCardGridProps {
  themes: Theme[]
  onEdit: (theme: Theme) => void
  onToggleStatus: (theme: Theme) => void
  onDelete: (theme: Theme) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}
```

Extract: `renderThemeCard` function (lines 392-516) + the grid rendering block (lines 561-565). The card actions (edit/toggle/delete/move up/down) become callback props.

- [ ] **Step 3: Create `ThemeFormDrawer.tsx`**

Props:
```typescript
interface ThemeFormDrawerProps {
  open: boolean
  editingTheme: Theme | null
  classList: ThemeClassItem[] | undefined
  submitting: boolean
  previewLoading: boolean
  onClose: () => void
  onSubmit: () => void
  onPreview: () => void
  // Template editor state (lifted or internal)
  templateMarkup: string
  onTemplateMarkupChange: (val: string) => void
  selectedClasses: string[]
  onSelectedClassesChange: (val: string[]) => void
  oldConfigJson: string
  onOldConfigJsonChange: (val: string) => void
  oldConfigError: string | null
}
```

Extract lines 567-757. This is the main Drawer containing:
- Form (basic info: name/description/shortName/gameName/previewImageUrl/status)
- Template editor (TextArea + variable insertion buttons + class selector)
- Old config section (Collapse with JSON editor + validation)
- Internal state: form, templateMarkup, selectedClasses, oldConfigJson, oldConfigError, textareaRef
- Preview-related things (handlePreview, handleInsertVariable) should stay as internal logic or be passed via props

Since this has a LOT of internal state, it may be better to keep `templateMarkup`, `selectedClasses`, `oldConfigJson`, `oldConfigError`, `textareaRef`, and related handlers inside the component. Make it a self-contained "form drawer" that receives `open`, `editingTheme`, `classList`, `submitting`, `previewLoading`, and emits `onSubmit`, `onPreview`, `onClose`.

```typescript
interface ThemeFormDrawerProps {
  open: boolean
  editingTheme: Theme | null
  classOptions: { label: string; value: string }[]
  submitting: boolean
  previewLoading: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  onPreview: (templateMarkup: string, selectedClasses: string[]) => Promise<string | null>
}
```

The drawer manages its own internal form state, template editor state, and old config state.

- [ ] **Step 4: Create `ThemePreviewModal.tsx`**

Props:
```typescript
interface ThemePreviewModalProps {
  open: boolean
  previewHtml: string
  onClose: () => void
}
```

Extract lines 759-786. Simple Modal with iframe.

- [ ] **Step 5: Refactor `Themes/index.tsx`**

Keep: query hooks, state for drawerOpen/editingTheme/submitting/previewLoading, handler logic for CRUD/toggle/sort.
Remove: template editor state (moves into ThemeFormDrawer), JSX blocks.
Compose:
```typescript
<PageHeader ... />
{isLoading && <PageSkeleton type="cards" />}
{isError && <Alert ... />}
{!isLoading && !isError && sortedThemes.length === 0 && <Empty ... />}
{!isLoading && !isError && sortedThemes.length > 0 && (
  <ThemeCardGrid ... />
)}
<ThemeFormDrawer ... />
<ThemePreviewModal ... />
```

---

### Task 3: Split FoodRecords Page (722 lines → index + 3 components)

**Delegation Recommendation:**
- Category: `deep` - Contains complex table columns, filters, and nested detail drawer; need careful type management
- Skills: `[]` - Standard refactoring

**Skills Evaluation:**
- ❌ OMITTED all skills: Pure refactoring task

**Depends On:** None

**Description:** Extract 3 subcomponents from `src/pages/FoodRecords/index.tsx`. The `FOOD_TYPE_MAP` and helper functions stay in index.tsx or move to a `constants.ts`.

**Acceptance Criteria:** FoodRecords/index.tsx compiles and renders identically; filter/search bar works with pagination reset; table shows batch selection; detail drawer shows images/AI desc/nutrition

**Files:**
- Create: `src/pages/FoodRecords/components/RecordFilterBar.tsx`
- Create: `src/pages/FoodRecords/components/RecordTable.tsx`
- Create: `src/pages/FoodRecords/components/RecordDetailDrawer.tsx`
- Create: `src/pages/FoodRecords/components/index.ts` (barrel export)
- Modify: `src/pages/FoodRecords/index.tsx`

- [ ] **Step 1: Create barrel export**

```typescript
// src/pages/FoodRecords/components/index.ts
export { default as RecordFilterBar } from './RecordFilterBar'
export { default as RecordTable } from './RecordTable'
export { default as RecordDetailDrawer } from './RecordDetailDrawer'
```

- [ ] **Step 2: Create `RecordFilterBar.tsx`**

Props:
```typescript
interface RecordFilterBarProps {
  foodName: string
  foodType: string | undefined
  themeId: number | undefined
  dateRange: [string, string] | null
  showDeleted: boolean
  themes: { id: number; name: string }[]
  onFoodNameChange: (val: string) => void
  onFoodTypeChange: (val: string | undefined) => void
  onThemeIdChange: (val: number | undefined) => void
  onDateRangeChange: (range: [string, string] | null) => void
  onShowDeletedChange: (val: boolean) => void
  onReset: () => void
}
```

Extract lines 589-669. Card containing:
- Search input, food type Select, theme Select, date RangePicker
- Show deleted Checkbox
- Reset button

Note: `FOOD_TYPE_MAP` and its options should be local to this component or imported from a shared constants file.

- [ ] **Step 3: Create `RecordTable.tsx`**

Props:
```typescript
interface RecordTableProps {
  dataSource: FoodRecordListItem[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  selectedRowKeys: number[]
  onPageChange: (page: number, pageSize: number) => void
  onSelectionChange: (keys: number[]) => void
  onViewDetail: (id: number) => void
  onDelete: (id: number) => void
  onRestore: (id: number) => void
}
```

Extract: columns definition (lines 203-357) + Table (lines 671-694). Keep the columns object inside the component. `maskOpenId` and `getFoodTypeConfig` helpers needed locally.

- [ ] **Step 4: Create `RecordDetailDrawer.tsx`**

Props:
```typescript
interface RecordDetailDrawerProps {
  open: boolean
  detailData: FoodRecordDetail | null | undefined
  loading: boolean
  onClose: () => void
}
```

Extract lines 360-558 + 696-717. Drawer wrapping the `renderDetailDrawer()` content:
- Image preview (original + theme composite)
- Basic info (Descriptions)
- AI description (short, game style, detail)
- Nutrition (protein, fat, carbs, fiber cards)
- Location info
- Associated check-in records
- Uses `getFoodTypeConfig` and `maskOpenId`

- [ ] **Step 5: Refactor `FoodRecords/index.tsx`**

Keep: state management (filters, pagination, selection, drawer), query hooks, handlers (handleSearch, handleBatchDelete, etc.)
Remove: columns definition, table JSX, filter bar JSX, drawer JSX.
Compose:
```typescript
<PageHeader title="食物记录" onRefresh={...} extra={batchDeleteButton} />
<RecordFilterBar ... />
<RecordTable ... />
<RecordDetailDrawer ... />
```

---

### Task 4: Update Routing Infrastructure (routes.ts + permissions.ts + Sidebar.tsx + App.tsx)

**Delegation Recommendation:**
- Category: `quick` - Well-defined, mechanical changes to constants files and JSX; no complex logic
- Skills: `[]` - Simple config/template changes

**Skills Evaluation:**
- ❌ OMITTED all skills: Straightforward constant additions

**Depends On:** None
**Acceptance Criteria:** 3 new Tavern routes resolve; sidebar shows sub-menu items under Tavern; permissions check correctly; lazy-loaded routes render

**Files:**
- Modify: `src/constants/routes.ts`
- Modify: `src/constants/permissions.ts`
- Modify: `src/components/Layout/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add route constants in `routes.ts`**

Add to ROUTES object:
```typescript
TAVERN_CHARACTERS: '/tavern/characters',
TAVERN_CHATS: '/tavern/chats',
TAVERN_KEYS: '/tavern/keys',
```

Add to MENU_ITEMS array (after the existing Tavern entry, before Users):
```typescript
{ path: ROUTES.TAVERN_CHARACTERS, scope: 'tavern', label: '角色管理' },
{ path: ROUTES.TAVERN_CHATS, scope: 'tavern', label: '聊天监控' },
{ path: ROUTES.TAVERN_KEYS, scope: 'tavern', label: 'Key 管理' },
```

- [ ] **Step 2: Add permissions in `permissions.ts`**

Add to PERMISSIONS object:
```typescript
TAVERN_CHARACTERS: 'tavern_characters',
TAVERN_CHATS: 'tavern_chats',
TAVERN_KEYS: 'tavern_keys',
```

Add to ROLE_PERMISSIONS.admin array:
```typescript
PERMISSIONS.TAVERN_CHARACTERS,
PERMISSIONS.TAVERN_CHATS,
PERMISSIONS.TAVERN_KEYS,
```

Add to ROUTE_PERMISSION_MAP:
```typescript
'/tavern/characters': PERMISSIONS.TAVERN_CHARACTERS,
'/tavern/chats': PERMISSIONS.TAVERN_CHATS,
'/tavern/keys': PERMISSIONS.TAVERN_KEYS,
```

- [ ] **Step 3: Add icons in `Sidebar.tsx`**

Import new icons:
```typescript
import {
  // ...existing imports
  ContainerOutlined,        // for chats
  KeyOutlined,             // for keys (already imported)
  IdcardOutlined,          // for characters
} from '@ant-design/icons'
```

Add to ICON_MAP:
```typescript
[ROUTES.TAVERN_CHARACTERS]: <IdcardOutlined />,
[ROUTES.TAVERN_CHATS]: <ContainerOutlined />,
[ROUTES.TAVERN_KEYS]: <KeyOutlined />,
```

Add to ROUTE_PERMISSION_MAP (local copy in Sidebar.tsx):
```typescript
[ROUTES.TAVERN_CHARACTERS]: PERMISSIONS.TAVERN_CHARACTERS,
[ROUTES.TAVERN_CHATS]: PERMISSIONS.TAVERN_CHATS,
[ROUTES.TAVERN_KEYS]: PERMISSIONS.TAVERN_KEYS,
```

- [ ] **Step 4: Add lazy imports + routes in `App.tsx`**

Add lazy imports:
```typescript
const TavernCharacters = lazy(() => import('@/pages/Tavern/TavernCharacters'))
const TavernChats = lazy(() => import('@/pages/Tavern/TavernChats'))
const TavernKeys = lazy(() => import('@/pages/Tavern/TavernKeys'))
```

Add Route elements inside the Tavern section (after the existing TAVERN route):
```tsx
<Route
  path={ROUTES.TAVERN_CHARACTERS}
  element={
    <Suspense fallback={<PageLoading />}>
      <TavernCharacters />
    </Suspense>
  }
/>
<Route
  path={ROUTES.TAVERN_CHATS}
  element={
    <Suspense fallback={<PageLoading />}>
      <TavernChats />
    </Suspense>
  }
/>
<Route
  path={ROUTES.TAVERN_KEYS}
  element={
    <Suspense fallback={<PageLoading />}>
      <TavernKeys />
    </Suspense>
  }
/>
```

---

### Task 5: Create TavernCharacters Page

**Delegation Recommendation:**
- Category: `deep` - New page with approve/reject/ban workflow, moderation logs; needs good UX for review queue
- Skills: `[]` - Standard CRUD page implementation

**Skills Evaluation:**
- ❌ OMITTED all skills: Standard data table page with modal workflows

**Depends On:** None (routes exist from T4, but file can be created independently)
**Acceptance Criteria:** Page shows character list with status filter (pending/published/banned); approve/reject buttons appear for pending characters; reject requires reason input; ban works for published characters; moderation log accessible per character

**Files:**
- Create: `src/pages/Tavern/TavernCharacters.tsx`

- [ ] **Step 1: Create `src/pages/Tavern/TavernCharacters.tsx`**

This page should:
1. **Stats cards** at top: total characters, pending review count, published count, banned count
2. **Two tabs or segments**: "待审核" (pending review) and "角色列表" (all characters)
3. **Pending review section**: Card list or table of pending characters, each with "批准" and "拒绝" buttons
4. **All characters table**: Filter by status, search by name
5. **Approve action** → POST `tavernAdminApi.approveCharacter(id)` → refresh
6. **Reject action** → Modal with reason TextArea → POST `tavernAdminApi.rejectCharacter(id, reason)` → refresh
7. **Ban action** → Popconfirm → POST `tavernAdminApi.banCharacter(id, reason)` → refresh
8. **Moderation log** → Drawer/Modal showing `tavernAdminApi.getModerationLogs(cardId)` results

Use existing types from `@/services/tavern`:
```typescript
import { tavernAdminApi } from '@/services/tavern'
import type { TavernCharacter, ModerationLog, TavernStats } from '@/services/tavern'
```

API calls to use:
- `tavernAdminApi.getCharacters({ page, pageSize, status })` — list with status filter
- `tavernAdminApi.getPendingList(page)` — pending queue
- `tavernAdminApi.approveCharacter(id)` — approve
- `tavernAdminApi.rejectCharacter(id, reason)` — reject with reason
- `tavernAdminApi.banCharacter(id, reason)` — ban
- `tavernAdminApi.getModerationLogs(cardId)` — view logs

Pattern (follow existing Game1 page style):
```typescript
import { useState } from 'react'
import { Table, Button, Tag, Space, Modal, Input, message, Popconfirm, Card, Row, Col, Statistic, Tabs } from 'antd'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { CheckOutlined, CloseOutlined, BanOutlined, HistoryOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { tavernAdminApi } from '@/services/tavern'
import type { TavernCharacter } from '@/services/tavern'

const { TextArea } = Input

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审核', color: 'orange' },
  PUBLISHED: { label: '已发布', color: 'green' },
  BANNED: { label: '已封禁', color: 'red' },
  REJECTED: { label: '已拒绝', color: 'volcano' },
}

export default function TavernCharacters() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [logCharacter, setLogCharacter] = useState<TavernCharacter | null>(null)

  // Queries
  const { data: charactersData, isLoading } = useQuery({
    queryKey: ['tavern-characters', page, statusFilter],
    queryFn: () => tavernAdminApi.getCharacters({ page, pageSize: 20, status: statusFilter }),
  })

  const { data: pendingData } = useQuery({
    queryKey: ['tavern-pending'],
    queryFn: () => tavernAdminApi.getPendingList(),
  })

  const { data: logData, isFetching: logLoading } = useQuery({
    queryKey: ['tavern-mod-logs', logCharacter?.id],
    queryFn: () => tavernAdminApi.getModerationLogs(logCharacter!.id),
    enabled: logDrawerOpen && !!logCharacter,
  })

  // Mutations
  const approveMut = useMutation({
    mutationFn: (id: string) => tavernAdminApi.approveCharacter(id),
    onSuccess: () => {
      message.success('角色卡已批准')
      queryClient.invalidateQueries({ queryKey: ['tavern-characters'] })
      queryClient.invalidateQueries({ queryKey: ['tavern-pending'] })
    },
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      tavernAdminApi.rejectCharacter(id, reason),
    onSuccess: () => {
      message.success('角色卡已拒绝')
      setRejectModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['tavern-characters'] })
      queryClient.invalidateQueries({ queryKey: ['tavern-pending'] })
    },
  })

  const banMut = useMutation({
    mutationFn: (id: string) => tavernAdminApi.banCharacter(id, '管理员操作'),
    onSuccess: () => {
      message.success('角色卡已封禁')
      queryClient.invalidateQueries({ queryKey: ['tavern-characters'] })
    },
  })

  // Handlers
  const handleApprove = (id: string) => approveMut.mutate(id)
  const handleReject = () => {
    if (!rejectingId) return
    rejectMut.mutate({ id: rejectingId, reason: rejectReason })
  }
  const handleBan = (id: string) => banMut.mutate(id)
  const handleOpenReject = (id: string) => {
    setRejectingId(id)
    setRejectReason('')
    setRejectModalOpen(true)
  }
  const handleOpenLog = (char: TavernCharacter) => {
    setLogCharacter(char)
    setLogDrawerOpen(true)
  }

  // Columns definition
  const columns = [
    { title: '角色名', dataIndex: 'name', key: 'name' },
    { title: '创建者', dataIndex: ['creator', 'nickname'], key: 'creator' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (status: string) => {
        const cfg = STATUS_MAP[status] ?? { label: status, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    { title: '对话', dataIndex: 'chatCount', key: 'chatCount', width: 80 },
    { title: '点赞', dataIndex: 'likeCount', key: 'likeCount', width: 80 },
    {
      title: '操作', key: 'action', width: 280,
      render: (_: unknown, record: TavernCharacter) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />}
                style={{ color: '#52c41a' }}
                loading={approveMut.isPending}
                onClick={() => handleApprove(record.id)}>批准</Button>
              <Button type="link" size="small" icon={<CloseOutlined />}
                danger
                onClick={() => handleOpenReject(record.id)}>拒绝</Button>
            </>
          )}
          {record.status === 'PUBLISHED' && (
            <Popconfirm title="确认封禁此角色卡？" onConfirm={() => handleBan(record.id)}>
              <Button type="link" size="small" icon={<BanOutlined />} danger>封禁</Button>
            </Popconfirm>
          )}
          <Button type="link" size="small" icon={<HistoryOutlined />}
            onClick={() => handleOpenLog(record)}>日志</Button>
        </Space>
      ),
    },
  ]

  // Render
  if (isLoading) return <PageSkeleton type="table" />

  return (
    <div>
      <PageHeader
        title="Tavern 角色管理"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tavern-characters'] })}
      />

      <Tabs defaultActiveKey="pending" items={[
        {
          key: 'pending',
          label: `待审核 (${pendingData?.data?.length ?? 0})`,
          children: (
            // pending list with approve/reject buttons
          ),
        },
        {
          key: 'all',
          label: '全部角色',
          children: (
            // full table
          ),
        },
      ]} />

      {/* Reject Modal */}
      <Modal
        title="拒绝角色卡"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleReject}
        confirmLoading={rejectMut.isPending}
      >
        <TextArea
          placeholder="请输入拒绝原因"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
        />
      </Modal>

      {/* Moderation Log Drawer */}
      <Drawer
        title={`审核日志 - ${logCharacter?.name ?? ''}`}
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        width={480}
      >
        <Spin spinning={logLoading}>
          {/* log list */}
        </Spin>
      </Drawer>
    </div>
  )
}
```

---

### Task 6: Create TavernChats Page

**Delegation Recommendation:**
- Category: `deep` - Chat monitoring with stats and message drill-down
- Skills: `[]` - Standard CRUD + detail drawer

**Skills Evaluation:**
- ❌ OMITTED all skills: Standard page implementation

**Depends On:** None
**Acceptance Criteria:** Page shows chat stats cards; chat list searchable by character/user; click to view message thread in drawer

**Files:**
- Create: `src/pages/Tavern/TavernChats.tsx`

- [ ] **Step 1: Create `src/pages/Tavern/TavernChats.tsx`**

Structure:
1. **Stats cards**: total chats today, active conversations, total messages, average session length
2. **Filter bar**: search by userId, filter by characterId
3. **Chat list table**: id, user, character, message count, created/last message at
4. **Message thread drawer**: shows all messages in a chat session

API calls:
- `tavernAdminApi.getChatStats()` → chat stats
- `tavernAdminApi.getChats({ page, pageSize, characterId, userId })` → paginated list
- `tavernAdminApi.getChatMessages(chatId, { page, pageSize })` → message list

Types:
```typescript
import { tavernAdminApi } from '@/services/tavern'
import type { TavernChatItem, TavernChatStats, TavernChatMessage } from '@/services/tavern'
```

---

### Task 7: Create TavernKeys Page

**Delegation Recommendation:**
- Category: `deep` - Key management with revoke workflow
- Skills: `[]` - Standard page

**Skills Evaluation:**
- ❌ OMITTED all skills: Simple list + action page

**Depends On:** None
**Acceptance Criteria:** Page shows API key list with user ID/provider/status; revoke button with confirmation works; revoked keys shown with strikethrough

**Files:**
- Create: `src/pages/Tavern/TavernKeys.tsx`

- [ ] **Step 1: Create `src/pages/Tavern/TavernKeys.tsx`**

Structure:
1. **Stats/dashboard**: total keys, active count, revoked count
2. **Filter**: search by userId
3. **Key list table**: id (masked), user, provider, active status, created at
4. **Revoke action** → Popconfirm → POST `tavernAdminApi.revokeApiKey(keyId)` → refresh

API calls:
- `tavernAdminApi.getApiKeys({ page, pageSize, userId })` → paginated list
- `tavernAdminApi.revokeApiKey(keyId)` → revoke

Types:
```typescript
import { tavernAdminApi } from '@/services/tavern'
import type { TavernApiKeyItem } from '@/services/tavern'
```

---

### Task 8: Refactor Tavern/index.tsx as Overview Hub

**Delegation Recommendation:**
- Category: `deep` - Need to re-architect existing page into navigation hub
- Skills: `[]` - Standard page refactoring

**Skills Evaluation:**
- ❌ OMITTED all skills: Clean refactoring, no specialized domain

**Depends On:** T4 (routes defined), T5 (TavernCharacters exists), T6 (TavernChats exists), T7 (TavernKeys exists)
**Acceptance Criteria:** Existing `/tavern` route renders overview with stats cards + navigation cards/links to 3 sub-pages; existing character list moves to `/tavern/characters`

**Files:**
- Modify: `src/pages/Tavern/index.tsx`

- [ ] **Step 1: Add navigation cards linking to sub-pages**

The current `/tavern` route shows stats + basic character table. Refactor it to be an overview page:

```typescript
import { Card, Row, Col, Statistic, Button, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CommentOutlined, TeamOutlined, MessageOutlined, KeyOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { ROUTES } from '@/constants/routes'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { tavernAdminApi } from '@/services/tavern'

export default function TavernPage() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['tavern-stats'],
    queryFn: () => tavernAdminApi.getStats(),
  })

  if (isLoading) return <PageSkeleton type="dashboard" />

  return (
    <div>
      <PageHeader title="AI 酒馆管理" />

      {/* Stats cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="总角色卡" value={stats?.totalCharacters ?? 0} prefix={<CommentOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="总对话数" value={stats?.totalChats ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="活跃用户" value={stats?.activeUsers ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待审核" value={stats?.pendingReviews ?? 0} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

      {/* Navigation cards */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card hoverable onClick={() => navigate(ROUTES.TAVERN_CHARACTERS)}>
            <Card.Meta
              avatar={<TeamOutlined style={{ fontSize: 32, color: '#1677ff' }} />}
              title="角色管理"
              description="审核、批准、封禁角色卡"
            />
            <Button type="link" icon={<ArrowRightOutlined />} style={{ marginTop: 12 }}>进入管理</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable onClick={() => navigate(ROUTES.TAVERN_CHATS)}>
            <Card.Meta
              avatar={<MessageOutlined style={{ fontSize: 32, color: '#52c41a' }} />}
              title="聊天监控"
              description="查看对话记录和消息内容"
            />
            <Button type="link" icon={<ArrowRightOutlined />} style={{ marginTop: 12 }}>进入监控</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable onClick={() => navigate(ROUTES.TAVERN_KEYS)}>
            <Card.Meta
              avatar={<KeyOutlined style={{ fontSize: 32, color: '#faad14' }} />}
              title="Key 管理"
              description="管理用户 API Key"
            />
            <Button type="link" icon={<ArrowRightOutlined />} style={{ marginTop: 12 }}>进入管理</Button>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
```

The old tavern wrapper `tavernApi` (lines 11-54) and character list are no longer needed here — they've been replaced by the dedicated sub-pages.

---

### Task 9: Type-Check and Fix

**Delegation Recommendation:**
- Category: `quick` - Run build/type-check, fix any issues
- Skills: `[]` - Standard verification

**Skills Evaluation:**
- ❌ OMITTED all skills: Standard verification

**Depends On:** T1–T8
**Acceptance Criteria:** `npm run type-check` passes with zero errors; dashboard can build

- [ ] **Step 1: Run type-check**

```bash
cd E:\.Code\.miniapps\dashboard
npm run type-check
```

Expected: No type errors.

**If errors occur**, fix them. Common issues:
- Missing exports from barrel files
- Incorrect prop types in subcomponents
- Import path mismatches
- Unused variables (due to `noUnusedLocals: true`)

---

### Task 10: Update state/approved_queue.yaml

**Delegation Recommendation:**
- Category: `quick` - Simple YAML edit
- Skills: `[]` - Trivial

**Skills Evaluation:**
- ❌ OMITTED all skills: Trivial YAML update

**Depends On:** T9
**Acceptance Criteria:** File updated to mark task as done

- [ ] **Step 1: Update the YAML file**

Change `E:\.Code\.miniapps\state\approved_queue.yaml`:
```yaml
- id: 1
  description: 'Dashboard 超大页面拆分与 Tavern/Game1 管理功能补齐 — ...'
  status: done
```

---

## Commit Strategy

Each task group gets its own atomic commit:

1. **`refactor(dashboard): split Achievements page into 5 subcomponents`**
   - Files: `src/pages/Achievements/{components/*,index.tsx}`

2. **`refactor(dashboard): split Themes page into 3 subcomponents`**
   - Files: `src/pages/Themes/{components/*,index.tsx}`

3. **`refactor(dashboard): split FoodRecords page into 3 subcomponents`**
   - Files: `src/pages/FoodRecords/{components/*,index.tsx}`

4. **`feat(dashboard): add Tavern sub-pages for characters, chats, keys`**
   - Files: `src/pages/Tavern/{index.tsx,TavernCharacters.tsx,TavernChats.tsx,TavernKeys.tsx}`

5. **`feat(dashboard): add routing and permissions for Tavern sub-pages`**
   - Files: `src/constants/routes.ts`, `src/constants/permissions.ts`, `src/components/Layout/Sidebar.tsx`, `src/App.tsx`

6. **`chore: update state tracking`**
   - Files: `state/approved_queue.yaml`

## Success Criteria

1. **All 3 large pages** (Achievements, Themes, FoodRecords) are composed of subcomponents, `index.tsx` files are < 200 lines each
2. **All 3 new Tavern pages** (Characters, Chats, Keys) work with their respective `tavernAdminApi` endpoints
3. **Routing** works: `/tavern` → overview, `/tavern/characters` → character management, etc.
4. **Permissions** enforced: sidebar shows sub-items only in Tavern scope for users with `tavern_characters`/`tavern_chats`/`tavern_keys` permissions
5. **Type-check** passes with zero errors
6. **No behavioral regression** — all existing features work as before
