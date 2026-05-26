# 代码约定

> **状态**: current
> **更新**: 2026-05-26
> 从 `AGENTS.md` 迁出的详细约定。

## TypeScript 严格度

全项目强制 `no-explicit-any: error`，但各项目严格度不同：

| 项目 | 特殊规则 |
|------|----------|
| Dashboard | `noUnusedLocals/Parameters: true`, `verbatimModuleSyntax: true` |
| MiniApp 通用 | 额外启用 `noUncheckedIndexedAccess: true`（Server 未启用） |
| tavern-server | `no-explicit-any: off` |

## 通用约定

- **2 空格缩进**，LF 换行，UTF-8
- **路径别名** `@/*` → 各项目 `src/`，MiniApp 另有 `@utils/@components/@services` 别名
- **Prettier**: ftg-miniapp/ftg-server/game1-server 统一 `printWidth:100, singleQuote:true, trailingComma:all`；tavern-server/dashboard 无独立配置
- **ESLint**: ftg-miniapp 含 React Hooks 规则 (`rules-of-hooks: error`)；Server 通用 `no-non-null-assertion: error`
- **Zod 校验**: game1-server 和 tavern-server 在路由层使用 Zod request validation
- **Prisma**: 统一 ORM，但版本分化 — ftg-server/dashboard v6.19, game1-server v5.22, tavern-server v5.10

## 特殊架构

- **Tavern Server 双文件入口**: `app.ts` 导出 `createServer()` 工厂函数，`index.ts` 实际启动监听（唯一个例）
- **Dashboard 无 ESLint 配置**（最严格的项目反而缺失）

## mp-automator 强制工作流（微信小程序）

**核心约束：Taro 源码 ≠ 运行时。** Taro 编译会改造 class 名称、CSS 输出位置、样式隔离策略。

### 触发条件

涉及以下任务时，MUST 先用自动化工具检查运行时状态：

| 任务类型 | 必须检查 |
|----------|----------|
| 样式/CSS 修改 | 运行时 class 名称是否与 CSS 选择器匹配 |
| 组件渲染变更 | 组件是否存在、display 值、transform/opacity |
| 页面导航变更 | 实际导航是否到达目标页、页面栈是否正确 |
| 用户交互修改 | 交互是否触发、元素是否可点击 |
| API 调用修改 | 网络请求是否发出、控制台有无报错 |
| 构建验证 | 对比 dist 产物与源码是否一致 |
| 任何 bug 修复 | 控制台日志 + 网络请求 + 运行时 DOM 状态 |

### 标准检查流程

```
1. launch → 启动开发者工具 + 连接自动化端口
2. relaunch /pages/xxx/index → 导航到目标页面
3. console → 看控制台有无报错
4. elements → 获取运行时 DOM，获取真实 class 名称
5. screenshot → 确认视觉效果
6. 对比 运行时 class 名 vs 编译后 CSS 选择器
```

### 修复后验证流程

```
修改源码后 MUST：
1. npm run build:weapp → 重新编译
2. 重新 launch/relaunch
3. console → 确认无新增报错
4. elements → 确认 class 名称匹配
5. screenshot → 截图对比
```

### 常见陷阱

- **CSS 选择器不匹配**: Taro 自定义组件会对 class 加文件名前缀
- **styleIsolation**: 微信原生样式隔离可能覆盖 Taro 编译产物
- **rpx 单位**: 设计稿 750，IDE 预览和真机渲染比例不同
- **native tabBar 页面**: 需用 `switchTab` 或 `reLaunch`
- **safe-area-inset-bottom**: 仅真机生效
- **组件不渲染**: 检查 dist-weapp/ 中是否有对应 wxss 和 JS

**工具路径**: `E:\.CodeTools\miniprogram-automator`
**前置条件**: 微信开发者工具 → 设置 → 安全 → 服务端口已开启

## NOTES

- **Dashboard 双进程**: Vite 前端(5173) + Express Admin API(3001) 独立运行
- **Dashboard 暗色模式**: Zustand 控制，localStorage 持久化，ConfigProvider darkAlgorithm
- **MiniApp CSS 变量系统**: `app.scss` 定义完整的颜色/字体/间距/阴影/z-index 变量
- **认证流程**: `wx.login()` → `POST /api/auth/wechat/login` → JWT → 本地持久化
- **生产架构**: Nginx(80/443) → Dashboard SPA / FTG API(/api/ftl/) / Game1 API(/api/v1/game1/) / Tavern API(/api/tavern/) / Admin API(/api/v1/admin/)
- **数据库架构 (2026-05-20 重构)**: 4 个独立数据库 — `miniapps`(公用) + `food_theme_generator`(FTG) + `ai_tavern`(Tavern) + `game1`(Game1)
- **Monorepo 非标准**: 无 root package.json workspaces，各项目独立 node_modules

## COMMANDS

### MiniApp (Taro)

```bash
# FTG — cd apps/ftg/client
npm run dev:weapp        # 开发模式(watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查

# Game1 — cd apps/game1/client
npm run dev:weapp
npm run build:weapp
npm run type-check

# Tavern — cd apps/tavern/client
npm run dev:weapp
npm run build:weapp
npm run type-check
npm run lint
npm run format
npm run generate-icons
```

### Server (Express)

```bash
# FTG Server — cd apps/ftg/server
npm run dev              # tsx watch 开发
npm run build            # tsc 编译
npm run lint
npm run db:migrate

# Game1 Server — cd apps/game1/server
npm run dev
npm run build
npm run type-check
npm run lint
npm run db:migrate

# Tavern Server — cd apps/tavern/server
npm run dev
npm run build
npm run type-check
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Dashboard

```bash
# cd dashboard
npm run dev              # Vite 开发(5173端口)
npm run build            # 生产构建
npm run type-check
npm run db:generate
```

### 部署

```bash
bash deploy/scripts/deploy.sh   # 一键构建+部署到 ECS
bash deploy/scripts/verify.sh   # 部署后健康检查
```

---

> 最后更新: 2026-05-24
