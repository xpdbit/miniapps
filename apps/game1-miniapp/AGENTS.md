# -*- coding: utf-8 -*-
"""
Game1 MiniApp OpenCode 指令 - 中文模式
"""

# PROJECT KNOWLEDGE BASE

## OVERVIEW
Taro 4.x + React 18 微信小程序，挂机放置游戏。纯 TS 游戏逻辑引擎 + Zustand 状态管理 + JSON 数据驱动配置。当前 Phase 1 — P2 开发阶段。

## STRUCTURE
```
src/
├── engine/          # 纯 TS 游戏逻辑引擎 (17子模块)
│   ├── core/        # GameLoop/EventBus/SaveManager/TimeManager
│   ├── actor/       # PlayerActor/ActorTemplate 角色系统
│   ├── combat/      # CombatEngine/StateMachine/DamageCalculator
│   ├── travel/      # TravelEngine/MileageManager/RouteEvent
│   ├── team/        # TeamEngine/JobSystem 队伍管理
│   ├── inventory/   # InventoryEngine/EquipmentSystem/DropEngine
│   ├── skill/       # SkillEngine — 技能学习/装备/效果
│   ├── card/        # CardEngine — 卡牌收集/合成/图鉴
│   ├── achievement/ # AchievementEngine/TaskEngine 成就任务
│   ├── event/       # EventChainEngine/EventTreeEngine 事件链
│   ├── prestige/    # PrestigeEngine 轮回转生
│   ├── idle/        # IdleRewardEngine 离线收益
│   ├── pet/         # PetEngine 宠物系统
│   ├── activity/    # ActivityEngine 活跃度系统
│   ├── race/        # RaceEngine 种族系统
│   ├── pvp/         # PvpEngine 玩家对战
│   └── map/         # RegionGenerator 地图生成
├── stores/          # Zustand 状态管理 (10 stores)
│   ├── gameStore.ts          # 全局游戏状态
│   ├── travelStore.ts        # 旅行状态
│   ├── combatStore.ts        # 战斗状态
│   ├── teamStore.ts          # 队伍状态
│   ├── inventoryStore.ts     # 背包状态
│   ├── skillStore.ts         # 技能状态
│   ├── cardStore.ts          # 卡牌状态
│   ├── achievementStore.ts   # 成就任务状态
│   ├── settingsStore.ts      # 设置状态
│   └── uiStore.ts            # UI 状态（弹窗/提示）
├── pages/           # 12 个页面
│   ├── home/        # 主界面
│   ├── dashboard/   # 状态面板
│   ├── travel/combat/team/inventory/
│   ├── skill/card/achievement/prestige/
│   └── event/pet/
├── components/      # 通用 UI 组件
│   ├── Dialog/      # 弹窗系统
│   ├── ProgressBar/ # 进度条/血条
│   ├── ResourceDisplay/ # 资源显示
│   ├── StatsCard/   # 状态卡片
│   └── Icon/        # 图标组件
└── config/          # JSON 数据配置 (13个)
    ├── items.json / actors.json / skills.json
    ├── cards.json / achievements.json / tasks.json
    ├── events.json / eventTrees.json
    ├── prestige.json / races.json
    └── constants.json / texts.json / loader.ts
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 引擎入口 | `engine/index.ts` | 统一导出所有引擎模块 |
| Store 入口 | `stores/index.ts` | 统一导出所有 Zustand store |
| 数据配置 | `config/` | JSON 驱动游戏数据（物品/角色/技能等） |
| 游戏循环 | `engine/core/GameLoop.ts` | 主循环 tick 驱动 |
| 战斗逻辑 | `engine/combat/` | CombatEngine + StateMachine + 伤害计算 |
| 旅行系统 | `engine/travel/` | 行进/里程/路线事件 |
| 装备掉落 | `engine/inventory/DropEngine.ts` | ItemDroppedPayload/ChestRewardPayload |
| 成就判定 | `engine/achievement/AchievementEngine.ts` | 条件监听 + 解锁触发 |
| UI 组件 | `components/` | Dialog/ProgressBar/ResourceDisplay/StatsCard/Icon |
| 工具函数 | `utils/` | 通用工具集 |
| 网络服务 | `services/` | HTTP 客户端封装 |

## CONVENTIONS
- TS 引擎完全独立，不依赖 Taro/React。纯函数 + 接口定义
- Store 作为引擎 ↔ 页面的桥梁，引擎输出状态变更 → Store 更新 → 页面 re-render
- JSON config 文件通过 `loader.ts` 统一加载并做类型推导
- 页面路由名与引擎模块名保持一致（如 combat → pages/combat/）
- `@/` 路径别名指向 `src/`，另有 `@utils/@components/@services/@stores/@constants/@types` 别名

## ANTI-PATTERNS
- ❌ Vitest 已配置但无任何测试文件 — 引擎纯函数非常适合单元测试，待补充
- ❌ 无 lint 脚本接入（package.json 有 eslint 但 scripts 中 lint 指向缺失的 eslint config）
- ❌ 无 CI/CD 配置 — Game1 Server 有 GitHub Actions 但 MiniApp 没有
- ❌ 部分 store 定义与引擎类型存在重复定义风险（如 skill / card / achievement）

## COMMANDS
```bash
# 开发 (Taro watch)
npm run dev:weapp        # 微信小程序开发模式

# 构建
npm run build:weapp      # 开发构建
npm run build:weapp:prod # 生产构建

# 类型检查
npm run type-check       # tsc --noEmit

# 测试 (Vitest)
npm run test             # vitest run
npm run test:watch       # vitest watch 模式

# 代码风格
npm run format           # Prettier 格式化
```
