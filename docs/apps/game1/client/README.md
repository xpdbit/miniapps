# Game1 客户端 — 挂机放置游戏

> 基于 Taro 4.x 的微信小程序，纯前端游戏逻辑，JSON 配置驱动。

## 技术栈

- **框架**: Taro 4.0.13 + React 18
- **语言**: TypeScript (strict)
- **状态管理**: Zustand 5 (10 个 store)
- **样式**: Sass
- **游戏循环**: setInterval 100ms (10fps), deltaTime clamp
- **配置**: 13 个 JSON 配置 + loader.ts

## 项目结构

```
src/
├── engine/          # 纯 TS 游戏引擎 (17 子模块)
│   ├── core/        # GameLoop, EventBus, SaveManager, TimeManager, TextManager
│   ├── actor/       # PlayerActor (单例), ActorTemplate 注册
│   ├── combat/      # CombatEngine (625L), CombatStateMachine, DamageCalculator
│   ├── travel/      # TravelEngine (718L), 体力/食物/士气, 里程里程碑
│   ├── team/        # 4 人队伍 CRUD + 职业系统
│   ├── inventory/   # 背包(动态列表+负重), 装备(5槽), 掉落加权随机
│   ├── skill/       # 12 个预设技能, 学习/装备/冷却
│   ├── card/        # 24 张卡牌, 6 稀有度, 保底 10/50/300
│   ├── achievement/ # 20 成就 + 7 日任务 + 7 周任务
│   ├── event/       # 3 线性链 + 3 分支树 + 20 队列
│   ├── prestige/    # 100+ 级重置, 7 天赋
│   ├── idle/        # 离线收益 (在线累积, 离线衰减)
│   ├── pet/         # 12 宠物模板, 收养/喂食/进化
│   ├── activity/    # APM 追踪, 3 档活跃等级
│   ├── race/        # 5 种族, 静态属性修正
│   ├── pvp/         # K=32 Elo 竞技场
│   └── map/         # 6 生物群系, 6 区域生成器
├── stores/          # 10 个 Zustand store
├── pages/           # 12 个页面
│   ├── home/        # 首页
│   ├── dashboard/   # 总览面板
│   ├── travel/      # 旅行
│   ├── combat/      # 战斗
│   ├── team/        # 队伍管理
│   ├── inventory/   # 背包
│   ├── skill/       # 技能
│   ├── card/        # 卡牌
│   ├── achievement/ # 成就
│   ├── prestige/    # 轮回
│   ├── event/       # 事件
│   └── pet/         # 宠物
├── components/      # 5 个通用组件 (Dialog, ProgressBar 等)
├── config/          # 13 个 JSON 配置 + loader.ts
└── services/        # api.ts (HTTP) + GameSyncManager.ts (云存档)
```

## 数据流

```
GameLoop.tick() → ITickable 模块 → EventBus → Zustand stores → 页面重渲染
```

## 启动流程

1. `app.tsx` 入口初始化
2. `itemRegistry.init()` 加载全量 JSON 配置
3. 微信登录鉴权
4. 云存档加载 (或本地存档)
5. `GameLoop.start()` 开始 100ms 游戏循环

## 开发命令

```bash
npm run dev:weapp    # 微信小程序开发 (watch)
npm run dev:h5       # H5 开发 (watch)
npm run build:weapp  # 微信小程序生产构建
npm run build:h5     # H5 生产构建
npm run type-check   # 类型检查
```

## 引擎设计要点

- **全部为纯函数 / 纯逻辑**: 无 UI 依赖, 可独立测试
- **ITickable 接口**: 所有模块实现 `onTick(deltaTime)` 统一由 GameLoop 驱动
- **离线计算**: `TimeManager.calcOfflineRewards()` 基于时间差和衰减系数
- **配置驱动**: 数值全在 JSON, 修改配置即修改玩法, 无需改代码
- **云存档**: `GameSyncManager` 自动同步, 2s debounce 防抖
