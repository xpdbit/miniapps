> 🚫 **废弃文档** — 路径已迁移至 `docs/apps/game1/client/README.md`。此旧文件保留作为归档参考。

# GAME1 — 挂机放置游戏 · 小程序重构方案

> **项目代号**: GAME1
> **源项目**: Unity 6 挂机放置游戏
> **目标平台**: 微信小程序 (Taro 4.x + React 18 + TypeScript)
> **文档版本**: v1.0

---

## 一、概述

### 1.1 动机

当前 Unity 项目是一个功能丰富的挂机放置类游戏，包含 **旅行、战斗、Roguelike、事件叙事、卡牌收集、队伍养成** 等 16+ 子系统。Unity 版本受限于：

- 3D 渲染管线开销（URP）与开发复杂度
- Windows 透明悬浮窗的窄平台覆盖
- 跨平台（iOS/Android）门槛高

小程序化后收益：

| 维度 | Unity 版 | 小程序版 |
|------|----------|---------|
| 开发量 | 全栈 3D + UI + 逻辑 | 纯 2D UI + 逻辑，减少 60%+ |
| 平台覆盖 | Windows 仅 | 微信生态（iOS/Android） |
| 分发 | 手动安装 | 扫码即用 |
| 更新 | 手动更新 | 热更新（微信审核） |
| 留存 | 被动 | 小程序卡片 + 订阅消息 |

### 1.2 原则

1. **逻辑复用** — C# 纯逻辑类直接翻译为 TypeScript，设计模式不改变
2. **UI 重写** — Unity UGUI → Taro React 组件，保持视觉风格即可
3. **数据驱动** — XML 配置 → JSON 配置，运行时数据通过 Zustand 管理
4. **增量迁移** — 按价值优先，核心玩法先上线，非核心后补
5. **不做美术降级** — 原版是文字/数值为主的挂机游戏，小程序 2D 即可还原

---

## 二、源项目功能全景

### 2.1 模块清单

| # | 模块 | 核心类 | 复杂度 | 转换优先级 |
|---|------|--------|--------|-----------|
| 1 | **游戏主循环** | GameLoopManager | ⭐⭐ | P0 |
| 2 | **存档系统** | SaveManager (XML) | ⭐⭐⭐ | P0 |
| 3 | **事件总线** | EventBus | ⭐ | P0 |
| 4 | **旅行系统** | TravelManager | ⭐⭐⭐⭐ | P0 |
| 5 | **资源系统** | TravelResourceManager | ⭐⭐ | P0 |
| 6 | **战斗系统** | CombatSystem, CombatStateMachine | ⭐⭐⭐⭐ | P0 |
| 7 | **队伍系统** | TeamDesign, JobSystem | ⭐⭐⭐ | P0 |
| 8 | **背包系统** | InventoryDesign, EquipmentSystem | ⭐⭐⭐ | P0 |
| 9 | **物品系统** | ItemManager | ⭐⭐ | P0 |
| 10 | **技能系统** | SkillDesign, SkillManager | ⭐⭐⭐ | P1 |
| 11 | **卡牌系统** | CardDesign, CardManager | ⭐⭐⭐ | P1 |
| 12 | **轮回系统** | PrestigeManager | ⭐⭐ | P2 |
| 13 | **成就系统** | AchievementDesign | ⭐⭐ | P1 |
| 14 | **任务系统** | TaskDesign (每日/每周) | ⭐⭐ | P1 |
| 15 | **宠物系统** | PetCompanionModule | ⭐⭐ | P2 |
| 16 | **PVP 系统** | PVPMatchManager | ⭐⭐⭐ | P3 |
| 17 | **挂机收益** | IdleRewardModule | ⭐ | P0 |
| 18 | **事件系统** | EventChain, EventTreeRunner | ⭐⭐⭐⭐ | P1 |
| 19 | **地图系统** | MapDesign, RegionGenerator | ⭐⭐⭐ | P1 |
| 20 | **玩家实体** | PlayerActor, IModule | ⭐⭐ | P0 |

### 2.2 核心数据流

```
玩家操作 / 后台Tick
       │
       ▼
GameLoopManager.Tick(deltaTime)
       │
       ├─► TravelManager.Tick() → 推进旅行进度
       │       ├─► RouteEventController → 触发事件
       │       └─► MileageManager → 累积里程
       │
       ├─► IdleRewardModule.Tick() → 在线/离线收益
       │
       ├─► ActivityMonitorModule.Tick() → 活跃度计算
       │
       └─► PlayerActor.Modules.ForEach(m => m.Tick())
               ├─► CombatModule (战斗冷却)
               └─► PetCompanionModule (宠物动画)
```

---

## 三、技术栈转换映射

| Unity 技术 | 小程序替代方案 | 说明 |
|-----------|---------------|------|
| C# 9.0 + .NET | TypeScript 5.x + Node 18 | 逐行翻译纯逻辑 |
| VContainer DI | 手动依赖注入 / 模块单例 | 保留 Singleton 模式 |
| UGUI | Taro React 组件 | View = div, Text = Text |
| Unity 协程 | async/await + Promise | WaitForSeconds → delay(ms) |
| ScriptableObject | JSON 配置文件 | 直接 import JSON |
| PlayerPrefs | wx.get/setStorageSync | 同步 API |
| EventBus | Zustand subscribe / EventBus | 保留发布-订阅模式 |
| 3D 场景/URP | 不适用 → 2D 界面 | CSS 布局 + 文字/图表 |

---

## 四、系统架构设计（小程序版）

### 4.1 总体分层

```
┌─────────────────────────────────────────────┐
│                 视图层 (UI)                   │
│  Taro React Components + Zustand Hooks       │
├─────────────────────────────────────────────┤
│              状态管理层 (Store)                │
│  PlayerStore / TravelStore / CombatStore ... │
├─────────────────────────────────────────────┤
│              逻辑层 (Engine)                   │
│  TravelEngine / CombatEngine / ... (纯TS)     │
├─────────────────────────────────────────────┤
│              基础设施层                        │
│  Storage / Timer / EventBus / ConfigLoader   │
└─────────────────────────────────────────────┘
```

### 4.2 目录结构

```
apps/game1-miniapp/
├── config/                  # Taro 配置
├── src/
│   ├── app.config.ts        # 小程序配置
│   ├── app.tsx              # 入口（GameLoop 初始化）
│   ├── pages/               # 12 页面
│   ├── engine/              # ⭐ 游戏逻辑引擎（纯TS）
│   │   ├── core/            # GameLoop/EventBus/SaveManager
│   │   ├── travel/          # TravelEngine/MileageManager
│   │   ├── combat/          # CombatEngine/StateMachine
│   │   ├── team/            # TeamEngine/JobSystem
│   │   ├── inventory/       # InventoryEngine/EquipmentSystem
│   │   ├── skill/           # SkillEngine
│   │   ├── card/            # CardEngine
│   │   ├── achievement/     # AchievementEngine/TaskEngine
│   │   ├── event/           # EventChainEngine/EventTreeEngine
│   │   ├── prestige/        # PrestigeEngine
│   │   ├── idle/            # IdleRewardEngine
│   │   ├── pet/             # PetEngine
│   │   ├── activity/        # ActivityEngine
│   │   ├── race/            # RaceEngine
│   │   ├── pvp/             # PvpEngine
│   │   ├── map/             # RegionGenerator
│   │   └── actor/           # PlayerActor/ActorTemplate
│   ├── stores/              # Zustand 状态管理 (10 stores)
│   ├── components/          # 通用 UI 组件
│   ├── hooks/               # 自定义 Hooks
│   └── config/              # JSON 配置数据 (13个)
└── package.json
```

---

## 五、开发里程碑

### Phase 0 — 基座搭建（2-3 天）

```bash
目标: 项目脚手架 + GameLoop + 存档 + 配置加载
☐ Taro 项目初始化
☐ Engine 核心层 (GameLoop/EventBus/TimeManager/SaveManager)
☐ Config JSON 转换工具
☐ 玩家实体 (PlayerActor)
☐ 离线时间计算
☐ 基础 UI 框架
```

### Phase 1 — 核心玩法（7-10 天）

```bash
目标: 可玩的挂机旅行 + 战斗循环
☐ TravelEngine + UI（进度条、状态、事件）
☐ CombatEngine + UI（文字日志、HP、结果）
☐ 队伍 + 背包 + 物品系统
☐ 挂机收益系统
☐ 完整的存档/读档流程
☐ 在线Tick → 离线恢复闭环
```

### Phase 2 — 系统深化（5-7 天）

```bash
☐ 技能系统 + 技能升级
☐ 卡牌系统 + 抽卡 + 图鉴
☐ 成就 + 任务（每日/每周刷新）
☐ 积压事件系统
☐ 里程 + 宝箱系统
☐ 事件系统（事件链 + 分支叙事）
```

### Phase 3 — 进阶内容（5-7 天）

```bash
☐ 轮回系统（Prestige）
☐ 地图系统（区域生成）
☐ 活跃度系统
☐ 宠物系统
☐ NPC 系统
☐ 资源系统（体力/食物/士气）
```

### Phase 4 — 社交 & 完善（3-5 天）

```bash
☐ PVP 系统（匹配/竞技场）
☐ 种族系统
☐ 微信分享卡片 + 订阅消息
☐ 性能优化 + 包体瘦身
☐ 审核准备
```

> **总计预计**: 22-32 天单人开发

---

## 六、核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Taro 4.x | 与 FTG 小程序统一 |
| 状态管理 | Zustand | 轻量、TS 友好 |
| 游戏循环 | setInterval 100ms | 平衡性能与精度 |
| 存储 | wx Storage + 云开发 | 核心数据本地 + 排行榜云端 |
| 配置格式 | JSON | 天然 TS 支持 |
| 样式方案 | Sass | 与 FTG 小程序一致 |
| 离线计算 | 客户端 | 秒级计算，无需网络 |

---

## 七、关键技术点

### 游戏循环频率

挂机游戏不需要 60fps。推荐 **10fps (100ms interval)**，UI 状态变更时即时刷新。

### 离线收益策略

```typescript
// 每次存档时记录时间戳
onSave() { wx.setStorageSync('lastSaveTime', Date.now()); }
// 启动时计算离线时长
onLoad() {
  const offlineMs = Date.now() - wx.getStorageSync('lastSaveTime');
  if (offlineMs > 5000) {
    const seconds = Math.min(offlineMs / 1000, 8 * 3600); // 最多8小时
    PlayerActor.processOfflineTime(seconds);
  }
}
```

### 放弃的功能

3D 场景/URP、全局键盘钩子、RawInput API、透明悬浮窗、xNode 编辑器、复杂战斗动画、2D 骨骼动画。

---

## 八、与微服务关系

| 服务 | 关系 |
|------|------|
| game1-server (Express + Prisma) | PVP 排行榜/云端存档 |
| dashboard (Ant Design) | Game1 管理后台可扩展 |
| apps/ftg-miniapp (Taro 4) | 共享 Taro 配置/CI/CD/部署脚本 |

---

> 最后更新: 2026-05-13
> 修改: 从 README.md 拆分独立为重构方案文档
