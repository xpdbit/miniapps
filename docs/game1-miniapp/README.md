# GAME1 — 挂机放置游戏 · 小程序重构方案

> **项目代号**: GAME1
> **源项目**: Unity 6 挂机放置游戏 (E:\UnityProgram\Game1)
> **目标平台**: 微信小程序 (Taro 4.x + React 18 + TypeScript)
> **文档版本**: v1.0
> **目标目录**: `E:\.Code\.miniapps\apps\game1-miniapp`

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

| # | 模块 | 路径 | 核心类 | 复杂度 | 转换优先级 |
|---|------|------|--------|--------|-----------|
| 1 | **游戏主循环** | Core/GameLoop/ | GameLoopManager | ⭐⭐ | P0 |
| 2 | **存档系统** | Core/SaveSystem/ | SaveManager (XML) | ⭐⭐⭐ | P0 |
| 3 | **事件总线** | Core/EventBus/ | EventBus | ⭐ | P0 |
| 4 | **旅行系统** | Modules/Travel/ | TravelManager | ⭐⭐⭐⭐ | P0 |
| 5 | **资源系统** | Modules/Travel/ | TravelResourceManager | ⭐⭐ | P0 |
| 6 | **里程系统** | Modules/Travel/ | MileageManager | ⭐⭐ | P1 |
| 7 | **战斗系统** | Modules/Combat/ | CombatSystem, CombatStateMachine | ⭐⭐⭐⭐ | P0 |
| 8 | **队伍系统** | Modules/Team/ | TeamDesign, JobSystem | ⭐⭐⭐ | P0 |
| 9 | **背包系统** | Modules/Inventory/ | InventoryDesign, EquipmentSystem | ⭐⭐⭐ | P0 |
| 10 | **物品系统** | Modules/Inventory/ | ItemManager | ⭐⭐ | P0 |
| 11 | **技能系统** | Modules/Skill/ | SkillDesign, SkillManager | ⭐⭐⭐ | P1 |
| 12 | **卡牌系统** | Modules/Card/ | CardDesign, CardManager | ⭐⭐⭐ | P1 |
| 13 | **轮回系统** | Modules/Prestige/ | PrestigeManager | ⭐⭐ | P2 |
| 14 | **成就系统** | Modules/Achievement/ | AchievementDesign | ⭐⭐ | P1 |
| 15 | **任务系统** | Modules/Achievement/ | TaskDesign (每日/每周) | ⭐⭐ | P1 |
| 16 | **种族系统** | Modules/Race/ | RaceDesign | ⭐ | P2 |
| 17 | **宠物系统** | Modules/Pet/ | PetCompanionModule | ⭐⭐ | P2 |
| 18 | **活跃度系统** | Modules/Activity/ | ActivityMonitorModule | ⭐ | P1 |
| 19 | **PVP 系统** | Modules/PVP/ | PVPMatchManager | ⭐⭐⭐ | P3 |
| 20 | **积压事件** | Modules/PendingEvent/ | PendingEventDesign | ⭐⭐ | P1 |
| 21 | **挂机收益** | Modules/Idle/ | IdleRewardModule | ⭐ | P0 |
| 22 | **地图系统** | Modules/Map/ | MapDesign, RegionGenerator | ⭐⭐⭐ | P1 |
| 23 | **事件系统** | Events/ | EventChain, EventTreeRunner | ⭐⭐⭐⭐ | P1 |
| 24 | **NPC 系统** | Entities/NPC/ | NPCSystem | ⭐⭐ | P2 |
| 25 | **玩家实体** | Entities/Player/ | PlayerActor, IModule | ⭐⭐ | P0 |
| 26 | **Actor 模板** | Entities/Actor/ | ActorManager | ⭐ | P0 |
| 27 | **输入系统** | Core/Input/ | InputConverter | ⭐⭐ | 替代方案 |
| 28 | **音频系统** | Core/Audio/ | AudioManager | ⭐⭐ | P2 |
| 29 | **文本系统** | Core/TextSystem/ | TextManager | ⭐ | P0 |

### 2.2 核心数据流（简化）

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

### 3.1 核心技术栈

| Unity 技术 | 小程序替代方案 | 说明 |
|-----------|---------------|------|
| **C# 9.0 + .NET 4.7.1** | TypeScript 5.x + Node 18 | 逐行翻译纯逻辑 |
| **VContainer DI** | 手动依赖注入 / 模块单例 | 保留 Singleton 模式 |
| **UGUI (Canvas/Image/Text)** | Taro React 组件 | View = div, Text = Text |
| **Unity 协程** | async/await + Promise | WaitForSeconds → delay(ms) |
| **ScriptableObject** | JSON 配置文件 | 直接 import JSON |
| **Unity Mathf** | 原生 Math | 无依赖 |
| **Unity Random** | Math.random() | 封装种子随机 |
| **PlayerPrefs / 文件存档** | wx.getStorageSync / wx.setStorageSync | 同步 API |
| **UniWindowController** | 微信原生窗口 | 小程序天然悬浮/后台 |
| **EventBus (自定义)** | Zustand subscribe / 自定义 EventBus | 保留发布-订阅模式 |
| **InputSystem** | 小程序 touch / tap 事件 | 点击/触摸 |
| **RawInput / 全局键盘钩子** | 不适用 | 小程序无后台键盘 |
| **3D 场景 / URP** | 不适用 | 改为 2D 界面 |
| **Animation (2D 骨骼)** | CSS animation / Lottie | 宠物动画 |
| **XML 配置解析** | JSON 直接 import | 转换一次工具 |
| **手动 ToXml/ParseFromXml** | JSON.stringify/parse | 简化序列化 |

### 3.2 核心差异与应对

| 差异 | Unity | 小程序 | 应对策略 |
|------|-------|--------|---------|
| **运行模型** | 帧驱动 (Update) | 事件驱动 | 用 `setInterval` 实现 Tick，进入后台时 pause |
| **后台运行** | 窗口透明 + RawInput | 小程序进入后台暂停 | 离线收益按退出时间累积（已有离线系统） |
| **持久化** | 本地 XML 文件 | wx Storage (10MB 限制) | 大文件走微信云开发数据库 |
| **UI 复杂度** | 即时模式 UI 更新 | 声明式 (React diff) | Zustand 状态驱动 UI 刷新 |
| **3D → 2D** | 3D 场景 + 摄像机 | CSS 布局 + 2D 精灵 | 保留宠物 2D 动画，其余用文字/图表 |
| **性能** | Native (C#) | JSCore (V8) | 计算密集型走 WebAssembly 或云函数 |

---

## 四、系统架构设计（小程序版）

### 4.1 总体分层

```
┌─────────────────────────────────────────────┐
│                 视图层 (UI)                   │
│  Taro React Components + Zustand Hooks       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐   │
│  │ 仪表盘│ │ 旅行页│ │ 战斗页│ │ 队伍/背包..│   │
│  └──────┘ └──────┘ └──────┘ └───────────┘   │
├─────────────────────────────────────────────┤
│              状态管理层 (Store)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ PlayerStore│ │TravelStore│ │ CombatStore   │  │
│  │ Inventory  │ │ TeamStore │ │ Achievement.. │  │
│  └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────┤
│              逻辑层 (Engine)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ TravelEngine│ │CombatEngine│ │ InventoryEngine │  │
│  │  (纯TS逻辑) │  │ (纯TS逻辑) │  │  (纯TS逻辑)   │  │
│  └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────┤
│              基础设施层                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐      │
│  │Storage│ │Timer │ │Event │ │Config  │      │
│  │      │ │Service│ │Bus   │ │Loader  │      │
│  └──────┘ └──────┘ └──────┘ └────────┘      │
└─────────────────────────────────────────────┘
```

### 4.2 目录结构

```
apps/game1-miniapp/
├── config/                     # Taro 配置
│   └── index.ts
├── src/
│   ├── app.config.ts           # 小程序配置
│   ├── app.tsx                 # 入口
│   ├── pages/                  # 页面
│   │   ├── dashboard/          # 仪表盘（主界面）
│   │   ├── travel/             # 旅行页面
│   │   ├── combat/             # 战斗页面
│   │   ├── team/               # 队伍管理
│   │   ├── inventory/          # 背包
│   │   ├── skill/              # 技能
│   │   ├── card/               # 卡牌
│   │   ├── achievement/        # 成就
│   │   ├── prestige/           # 轮回
│   │   ├── event/              # 事件交互
│   │   └── pet/                # 宠物
│   │
│   ├── engine/                 # ⭐ 游戏逻辑引擎（纯TS）
│   │   ├── core/
│   │   │   ├── GameLoop.ts     # 主循环
│   │   │   ├── EventBus.ts     # 事件总线
│   │   │   ├── TimeManager.ts  # 时间管理（在线/离线）
│   │   │   └── SaveManager.ts  # 存档管理
│   │   │
│   │   ├── travel/
│   │   │   ├── TravelEngine.ts       # 旅行逻辑
│   │   │   ├── MileageManager.ts     # 里程
│   │   │   ├── TravelResource.ts     # 资源（体力/食物/士气）
│   │   │   └── RouteEventController.ts # 路径事件
│   │   │
│   │   ├── combat/
│   │   │   ├── CombatEngine.ts       # 战斗核心
│   │   │   ├── CombatStateMachine.ts # 状态机
│   │   │   ├── DamageCalculator.ts   # 伤害计算
│   │   │   └── Commands/            # 命令模式
│   │   │
│   │   ├── team/
│   │   │   ├── TeamEngine.ts        # 队伍逻辑
│   │   │   └── JobSystem.ts         # 职业系统
│   │   │
│   │   ├── inventory/
│   │   │   ├── InventoryEngine.ts   # 背包逻辑
│   │   │   └── EquipmentSystem.ts   # 装备系统
│   │   │
│   │   ├── skill/
│   │   │   ├── SkillEngine.ts       # 技能逻辑
│   │   │   └── SkillData.ts         # 技能数据
│   │   │
│   │   ├── card/
│   │   │   └── CardEngine.ts        # 卡牌 + 抽卡
│   │   │
│   │   ├── achievement/
│   │   │   ├── AchievementEngine.ts # 成就
│   │   │   └── TaskEngine.ts        # 任务（每日/每周）
│   │   │
│   │   ├── event/
│   │   │   ├── EventChainEngine.ts  # 事件链
│   │   │   └── EventTreeEngine.ts   # 事件树（分支叙事）
│   │   │
│   │   ├── prestige/
│   │   │   └── PrestigeEngine.ts   # 轮回
│   │   │
│   │   ├── idle/
│   │   │   └── IdleRewardEngine.ts  # 挂机收益
│   │   │
│   │   ├── pet/
│   │   │   └── PetEngine.ts        # 宠物
│   │   │
│   │   ├── activity/
│   │   │   └── ActivityEngine.ts    # 活跃度
│   │   │
│   │   ├── race/
│   │   │   └── RaceEngine.ts       # 种族
│   │   │
│   │   ├── pvp/
│   │   │   └── PvpEngine.ts        # PVP
│   │   │
│   │   ├── pending-event/
│   │   │   └── PendingEventEngine.ts # 积压事件
│   │   │
│   │   ├── map/
│   │   │   └── RegionGenerator.ts   # 区域地图
│   │   │
│   │   └── actor/
│   │       ├── ActorTemplate.ts    # 角色模板
│   │       └── PlayerActor.ts      # 玩家实体
│   │
│   ├── stores/                  # Zustand 状态管理
│   │   ├── playerStore.ts
│   │   ├── travelStore.ts
│   │   ├── combatStore.ts
│   │   ├── teamStore.ts
│   │   ├── inventoryStore.ts
│   │   ├── skillStore.ts
│   │   ├── cardStore.ts
│   │   ├── achievementStore.ts
│   │   └── uiStore.ts
│   │
│   ├── components/              # 通用 UI 组件
│   │   ├── ProgressBar/         # 进度条
│   │   ├── Dialog/             # 选择对话框
│   │   ├── Card/               # 卡牌展示
│   │   ├── TeamMember/         # 队员卡片
│   │   ├── PetDisplay/         # 宠物展示
│   │   └── ...                 # 更多
│   │
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useGameLoop.ts
│   │   ├── useTimer.ts
│   │   └── useStorage.ts
│   │
│   ├── config/                  # 配置数据
│   │   ├── items.json          # 物品配置
│   │   ├── actors.json         # 角色配置
│   │   ├── events.json         # 事件配置
│   │   ├── eventTrees.json     # 事件树配置
│   │   ├── skills.json         # 技能配置
│   │   ├── cards.json          # 卡牌配置
│   │   ├── achievements.json   # 成就配置
│   │   ├── tasks.json          # 任务配置
│   │   └── prestige.json       # 轮回配置
│   │
│   └── utils/                   # 工具函数
│       ├── math.ts              # 数学计算
│       ├── random.ts            # 种子随机
│       ├── format.ts            # 格式化
│       └── time.ts              # 时间处理
│
├── data/                        # 运行时数据存储（wx storage）
├── package.json
├── tsconfig.json
└── project.config.json          # 微信小程序配置
```

---

## 五、核心模块转换详解

### 5.1 GameLoop — 游戏主循环

**Unity 版**: 帧驱动，`GameLoopManager.Tick(float deltaTime)` 在 `MonoBehaviour.Update()` 中每帧调用，驱动所有子系统。

**小程序版**:

```typescript
// src/engine/core/GameLoop.ts
class GameLoop {
  private timerId: number | null = null;
  private lastTickTime: number = 0;
  private isRunning: boolean = false;

  // 引擎模块注册表
  private modules: ITickable[] = [];

  start() {
    this.isRunning = true;
    this.lastTickTime = Date.now();
    this.tick();
  }

  private tick() {
    if (!this.isRunning) return;

    const now = Date.now();
    const deltaMs = now - this.lastTickTime;
    this.lastTickTime = now;

    // 限制最大 delta，防止切后台回来后跳帧
    const clampedDelta = Math.min(deltaMs, 1000);

    // 驱动所有模块
    for (const module of this.modules) {
      module.tick(clampedDelta / 1000); // 转为秒
    }

    // 每个 Tick 后通知 UI 更新
    this.notifyUI();

    // 调度下一帧（约 100ms 一次，挂机游戏不需要 60fps）
    this.timerId = setTimeout(() => this.tick(), 100);
  }

  pause() { ... }
  resume() { ... }

  registerModule(module: ITickable) { ... }
}
```

**关键差异**:
- `Update()` → `setTimeout` 定时循环（100ms 间隔）
- 小程序切后台时 `pause()`，回来后计算离线时间
- 已有 `ProcessOfflineTravel` 逻辑可直接复用

### 5.2 Travel — 旅行系统

**Unity 版**: 最复杂的模块，包含：
- `TravelManager` — 状态机（Idle/Traveling/Arrived/InSettlement/Crossroad/EventActive）
- `MileageManager` — 里程累积 + 宝箱
- `TravelResourceManager` — 体力/食物/士气
- `RouteEventController` — 路径事件触发
- `ProgressManager` — 进度点 + 事件触发阈值

**小程序版**: 逻辑 1:1 翻译，UI 改为：
- 顶部进度条代替 3D 场景
- 文字日志代替场景动画
- 选择弹窗代替 3D NPC 交互

> 旅行系统转换工作量预计占总量 20%，是所有模块中最大的。

### 5.3 Combat — 战斗系统

**Unity 版**:
- `CombatStateMachine` — 状态机（准备/进行中/胜利/失败）
- `CombatCommandQueue` — 命令队列模式
- `DamageCalculator` — 伤害计算
- `ICombatant` 接口 — 战斗者抽象

**小程序版**:
- 纯逻辑全部保留，数值公式不变
- UI 改为文字日志 + 进度条 HP 显示
- 命令模式改为 Promise 链式执行
- 动画调度（CombatAnimationDispatcher）改为 CSS 过渡

### 5.4 Team — 队伍系统

**Unity 版**: `TeamDesign` 单例 + `TeamManager` 静态 API + `JobSystem` 职业

**小程序版**: 保持相同架构，职业系统（商贾/镖师/学者/医者）的数值逻辑全部保留。

### 5.5 Save — 存档系统

**Unity 版**: 手动 XML 序列化（`ToXml`/`ParseFromXml`），多个 SaveFile 类型。

**小程序版**:
- 直接 `JSON.stringify` / `JSON.parse`
- 存储使用 `wx.setStorageSync`（同步，适合小数据）
- 大数据（地图种子等）走微信云开发
- 多文件拆分规则不变

### 5.6 Events — 事件系统

**Unity 版**: 分支叙事引擎 `EventTreeRunner` + 事件链 `EventChain` + 事件队列 `EventQueue`

**小程序版**:
- 逻辑完全保留，事件树引擎是纯逻辑可 1:1 翻译
- UI 改为 `Swiper` / `Dialog` 组件展示
- 分支选择弹窗用原生 `Modal` 或自定义组件

### 5.7 Card — 卡牌系统（简化版）

**Unity 版**: 完整抽卡系统 + 卡牌收集 + 稀有度（N/R/SR/SSR/UR/GR）

**小程序版**: 降低美术需求
- 卡牌改为 **文字卡片** + CSS 渐变色稀有度标识
- 抽卡动画改为 CSS 翻转/辉光效果
- 保底机制（Pitty System）逻辑不变

---

## 六、开发里程碑

### Phase 0 — 基座搭建（2-3 天）

```
目标: 项目脚手架 + GameLoop + 存档 + 配置加载
输出:
  ☐ Taro 项目初始化 (taro init)
  ☐ Engine 核心层 (GameLoop, EventBus, TimeManager, SaveManager)
  ☐ Config JSON 转换工具（原 XML → JSON）
  ☐ 玩家实体 (PlayerActor)
  ☐ 离线时间计算
  ☐ 基础 UI 框架（Tab 导航 + 仪表盘）
```

### Phase 1 — 核心玩法（7-10 天）

```
目标: 可玩的挂机旅行 + 战斗循环
输出:
  ☐ TravelEngine + UI（进度条、状态、事件）
  ☐ CombatEngine + UI（文字日志、HP、结果）
  ☐ 队伍 + 背包 + 物品系统
  ☐ 挂机收益系统
  ☐ 完整的存档/读档流程
  ☐ 在线Tick → 离线恢复闭环
```

### Phase 2 — 系统深化（5-7 天）

```
目标: 丰富玩法系统
输出:
  ☐ 技能系统 + 技能升级
  ☐ 卡牌系统 + 抽卡 + 图鉴
  ☐ 成就 + 任务（每日/每周刷新）
  ☐ 积压事件系统
  ☐ 里程 + 宝箱系统
  ☐ 事件系统（事件链 + 事件树 + 分支叙事）
```

### Phase 3 — 进阶内容（5-7 天）

```
目标: 长线留存系统
输出:
  ☐ 轮回系统（Prestige）
  ☐ 地图系统（区域生成）
  ☐ 活跃度系统
  ☐ 宠物系统
  ☐ NPC 系统
  ☐ 资源系统（体力/食物/士气）
```

### Phase 4 — 社交 & 完善（3-5 天）

```
目标: 社交功能 + 上线准备
输出:
  ☐ PVP 系统（匹配/竞技场）
  ☐ 种族系统
  ☐ 微信分享卡片
  ☐ 订阅消息（离线完成通知）
  ☐ 性能优化 + 包体瘦身
  ☐ 审核准备
```

> **总计预计**: 22-32 天单人开发，按 P0→P4 分阶段上线，P1 完成后即可发布 MVP。

---

## 七、关键设计决策

### 7.1 游戏循环频率

挂机游戏不需要 60fps。推荐 **10fps (100ms interval)** 作为 Tick 频率，UI 状态变更时即时刷新。低频循环能显著降低小程序 JSCore 功耗。

### 7.2 离线收益策略

小程序天然不支持后台常驻。复用 Unity 版已有的离线时间累积逻辑：

```typescript
// 每次存档时记录时间戳
onSave() {
  wx.setStorageSync('lastSaveTime', Date.now());
}

// 启动时计算离线时长
onLoad() {
  const lastSave = wx.getStorageSync('lastSaveTime');
  const offlineMs = Date.now() - lastSave;
  if (offlineMs > 5000) { // 超过5秒视为离线
    const offlineSeconds = Math.min(offlineMs / 1000, 8 * 3600); // 最多8小时
    PlayerActor.processOfflineTime(offlineSeconds);
  }
}
```

### 7.3 性能关键路径

| 操作 | 优化策略 |
|------|---------|
| Tick 循环 | 100ms 间隔，避免 requestAnimationFrame |
| 伤害计算 | 纯函数 + memo，次毫秒级 |
| 事件树解析 | 预先加载 JSON，运行时只遍历节点引用 |
| UI 刷新 | Zustand selector 细粒度订阅，避免全量渲染 |
| 存档 | 懒写 + 退出时强制写 |

### 7.4 放弃的功能

以下 Unity 特性在小程序版中**不实现**：

| 功能 | 原因 |
|------|------|
| **3D 场景 / URP** | 小程序不支持 WebGL 复杂渲染 |
| **全局键盘钩子** | 小程序无后台键盘 |
| **RawInput API** | Windows 专用 |
| **透明悬浮窗** | 小程序窗口系统固定 |
| **xNode 事件树编辑器** | Unity Editor 专用，数据格式改为 JSON 即可 |
| **复杂战斗动画** | 改为文字日志 + CSS 过渡 |
| **2D 骨骼动画** | 宠物改为 CSS/Lottie 动画或逐帧精灵 |

---

## 八、数据配置文件转换

### 8.1 XML → JSON 转换

Unity 版所有配置在 `Assets/Resources/Data/` 下，格式为 XML：

| 文件 | 路径 | 转换方式 |
|------|------|---------|
| Items.xml | Resources/Data/Items/ | 手动转 JSON |
| Actors.xml | Resources/Data/Actors/ | 手动转 JSON |
| Events.xml | Resources/Data/Events/ | 手动转 JSON |
| EventTrees.xml | Resources/Data/EventTrees/ | 手动转 JSON |
| Cards.xml | Resources/Data/Cards/ | 手动转 JSON |
| Skills.xml | Resources/Data/Skills/ | 手动转 JSON |
| Achievements.xml | Resources/Data/Achievements/ | 手动转 JSON |
| Tasks.xml | Resources/Data/Tasks/ | 手动转 JSON |
| Prestige.xml | Resources/Data/Prestige/ | 手动转 JSON |
| Races.xml | Resources/Data/Races/ | 手动转 JSON |
| Texts.xml | Resources/Data/Texts/ | 手动转 JSON |

> 建议编写一个 Node.js 脚本批量转换（xml2js 库）。

### 8.2 ID 命名规范保留

沿用 Unity 版的 **统一 ID 规则**：

```
Core.Item.GoldCoin
Core.Item.ShortBlade
Core.Actor.Player
Core.Actor.Bandit
Core.Event.EncounterBandit
Core.EventTree.MerchantEncounter
```

---

## 九、与现有微服务的关系

当前 `E:\.Code\.miniapps` 已有完整技术栈：

| 服务 | 已有项目 | 与 GAME1 关系 |
|------|---------|---------------|
| servers/ftg-server (Express + Prisma) | ✅ 食物主题项目 | PVP 排行榜/云端存档可复用 |
| dashboard (Ant Design) | ✅ 已有 | GAME1 管理后台可扩展 |
| cloud-functions | 规划中 | GAME1 云端存档优先使用 |
| apps/ftg-miniapp (Taro 4) | ✅ 已有 | 可复用 Taro 配置/CI/CD/部署脚本 |

GAME1 作为独立小程序项目，与 apps/ftg-miniapp **共享基础设施**但不共享业务逻辑。建议：

1. 复用 `package.json` 中的 Taro 版本锁定
2. 复用 CI/CD 部署脚本 (`deploy/` 目录)
3. 复用微信云开发环境（如适用）
4. 管理后台可扩展 GAME1 数据面板

---

## 十、核心技术决策清单

| 决策 | 选项 | 推荐 |
|------|------|------|
| 框架 | Taro / uni-app / 原生 | **Taro 4.x**（与 apps/ftg-miniapp 统一） |
| 状态管理 | Zustand / Redux / MobX | **Zustand**（轻量、TS 友好） |
| 游戏循环 | setInterval / RAF / Web Worker | **setInterval 100ms**（平衡性能与精度） |
| 存储 | wx Storage / 云开发 DB | **wx Storage**（核心数据）+ **云开发**（排行榜） |
| 配置格式 | JSON / YAML / XML | **JSON**（天然 TS 支持） |
| UI 风格 | 微信 WeUI / 自绘 | **自绘**（保持原 Unity 视觉风格） |
| 样式方案 | Sass / Less / CSS Modules | **Sass**（与 apps/ftg-miniapp 一致） |
| 离线计算 | 客户端 / 云函数 | **客户端**（秒级计算，无需网络） |
| 测试 | Jest / Vitest | **Vitest**（ESM 原生支持） |

---

## 附录 A — C# 到 TypeScript 翻译示例

### A.1 单例模式

```csharp
// C# (Unity)
public class TravelManager
{
    private static TravelManager _instance;
    public static TravelManager instance => _instance ??= new TravelManager();
}
```

```typescript
// TypeScript
class TravelEngine {
  private static _instance?: TravelEngine;
  static get instance(): TravelEngine {
    return this._instance ??= new TravelEngine();
  }
}
```

### A.2 事件发布-订阅

```csharp
// C#
public event Action<TravelStatus> onStatusChanged;
public event Action<float> onTravelProgress;
```

```typescript
// TypeScript
private _listeners: Map<string, Set<Function>> = new Map();

on(event: 'statusChanged', cb: (status: TravelStatus) => void): void;
on(event: 'travelProgress', cb: (progress: number) => void): void;
on(event: string, cb: Function): void {
  if (!this._listeners.has(event)) this._listeners.set(event, new Set());
  this._listeners.get(event)!.add(cb);
}

emit(event: 'statusChanged', data: TravelStatus): void;
emit(event: 'travelProgress', data: number): void;
emit(event: string, data: any): void {
  this._listeners.get(event)?.forEach(cb => cb(data));
}
```

### A.3 协程 → async/await

```csharp
// C# 协程
private IEnumerator StartGameWhenReady() {
    while (_gameLoopManager == null || !_gameLoopManager.IsInitialized) {
        yield return null; // 等一帧
    }
    StartGame();
}
```

```typescript
// TypeScript async/await
async function startGameWhenReady(): Promise<void> {
    while (!gameLoop?.isInitialized) {
        await delay(100); // 等 100ms
    }
    startGame();
}
```

### A.4 手动 XML 序列化 → JSON

```csharp
// C# 手动 XML
public void ToXml(XmlElement element) {
    element.SetAttribute("id", itemId);
    element.SetAttribute("count", count.ToString());
    var sub = element.OwnerDocument.CreateElement("modifiers");
    foreach (var m in modifiers) {
        var me = sub.OwnerDocument.CreateElement("modifier");
        me.SetAttribute("type", m.type.ToString());
        me.SetAttribute("value", m.value.ToString());
        sub.AppendChild(me);
    }
    element.AppendChild(sub);
}
```

```typescript
// TypeScript JSON
const saveData = {
  id: this.itemId,
  count: this.count,
  modifiers: this.modifiers.map(m => ({
    type: m.type,
    value: m.value
  }))
};
wx.setStorageSync('inventory', JSON.stringify(saveData));
```

---

## 附录 B — 参考资源

| 资源 | 说明 |
|------|------|
| [Taro 4.x 文档](https://docs.taro.zone/) | 小程序框架 |
| [Zustand 文档](https://github.com/pmndrs/zustand) | 状态管理 |
| [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/) | 原生 API |
| [微信云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html) | 云函数/数据库 |
| [mp-automator](../../cloud-functions/README.md) | 小程序自动化测试工具 |
| [apps/ftg-miniapp](../../apps/ftg-miniapp/) | 已有 Taro 小程序参考 |
| [unity-game-save-adapter](./SERIALIZATION_ADAPTER.md) | 存档转换适配器（如需要） |
