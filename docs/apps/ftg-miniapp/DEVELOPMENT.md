# 开发指南

> 🚫 **旧架构文档** — 本文档部分内容基于已弃用的 CloudBase 云函数架构 (2025)。
> 当前开发环境已完全迁移至 `servers/ftg-server`（Express REST API）+ Taro 小程序。
> 本文档中的云函数/CloudBase 相关内容已过时，仅保留供参考。
> 如有冲突，以根目录 AGENTS.md 和具体项目代码为准。

## 环境搭建

### 前置要求

- **Node.js** >= 18
- **npm** >= 9
- **微信开发者工具** [下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- **微信小程序 AppID**（需注册微信公众平台）
- **后端服务**：servers/ftg-server（`cd servers/ftg-server && npm install && npm run dev`）

### 后端服务 (REST API — 当前架构)

当前不再依赖微信云开发。后端为独立的 Express 服务：

```bash
cd servers/ftg-server
npm install
npm run dev        # tsx watch, port 3000
npm run lint       # ESLint 检查
npm run type-check # TypeScript 类型检查
```

小程序通过 HTTP 客户端（`services/httpClient.ts`）调用 REST API，
使用 `wx.login()` → JWT token 进行认证（而非 CloudBase 免登录）。

### 项目初始化

```bash
cd apps/ftg-miniapp
npm install
cp .env.dev .env
```

编辑 `.env`，填入实际值（模板参考 `.env.dev`）：
```
TARO_APP_API_BASE=https://your-api-domain.com
TARO_APP_MOCK_AUTH=false
```

---

## 开发工作流

### 启动开发

```bash
npm run dev:weapp
```

此命令启动 Taro 开发服务器，监听文件变化自动重新编译到 `dist/` 目录。

在微信开发者工具中：
1. 打开项目 → 选择 `apps/ftg-miniapp` 目录
2. 设置 → 勾选「不校验合法域名」用于本地调试
3. 点击「编译」查看效果

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev:weapp` | 开发模式（watch） |
| `npm run build:weapp` | 普通构建 |
| `npm run build:weapp:prod` | 生产构建 |
| `npm run lint` | ESLint 检查 + 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run type-check` | TypeScript 类型检查 |



## 目录职责

### src/pages/ — 页面

每个页面一个文件夹，包含：
- `index.tsx` — 页面组件
- `index.config.ts` — 页面配置（导航栏标题等）
- `index.scss` — 页面样式

页面通过 `app.config.ts` 中的路由表注册。

### src/components/ — 公共组件

可跨页面复用的 UI 组件。如 `Loading.tsx`。

### src/services/ — 服务层

业务逻辑封装，不直接操作 UI：

```
services/
├── db/                    # DAL 数据访问层
│   ├── BaseDAL.ts         # 基础 CRUD（所有 DAL 继承）
│   ├── userDAL.ts         # 用户数据操作
│   ├── foodRecordDAL.ts   # 食物记录操作
│   ├── checkinDAL.ts      # 打卡记录操作
│   ├── achievementDAL.ts  # 成就数据操作
│   ├── userAchievementDAL.ts
│   ├── themeDAL.ts        # 主题数据操作
│   ├── apiKeyDAL.ts       # API 密钥操作
│   └── schema.ts          # 数据库 Schema 定义
├── userService.ts         # 用户业务服务
└── apiKeyService.ts       # API 密钥服务
```

### src/utils/ — 工具函数

纯函数，无副作用，可独立测试：

```
utils/
├── canvas/
│   ├── composer.ts        # 主题合成器（核心）
│   ├── templateLoader.ts  # 模板加载
│   └── themes/            # 主题 JSON 配置
│       ├── dont_starve.json
│       ├── stardew_valley.json
│       └── zelda_cooking.json
├── image/
│   └── processor.ts       # 图片预处理
├── location/
│   └── locationService.ts # 定位服务
├── share/
│   └── shareCard.ts       # 分享卡片生成
└── errorBoundary.tsx      # 错误边界组件
```

### (已废弃) cloudfunctions/ — 旧云函数目录

> 该项目目录已不再用于当前架构。云函数相关功能已由 `servers/ftg-server` 的 REST API 替代。
> 该目录下的文件保留供参考，不再维护。

---

## 开发规范

### TypeScript

- **严格模式** (`strict: true`)
- ❌ 禁止 `any` 类型
- ❌ 禁止 `@ts-ignore` / `@ts-expect-error`
- ✅ 所有函数参数和返回值必须显式类型标注

### 代码风格

- **ESLint**：零容忍，提交前通过 `npm run lint`
- **Prettier**：统一格式化（2空格缩进、单引号、无分号）
- **命名约定**：
  - 组件文件：PascalCase（`Loading.tsx`）
  - 工具/服务：camelCase（`userService.ts`）
  - 常量/类型：camelCase（`foodTypes.ts`）
  - SCSS：使用 BEM 风格命名

### 日志规范

- ❌ 禁止 `console.log`（生产代码）
- ✅ 使用 `console.warn` / `console.error` 替代
- 云函数中使用 `shared/logger.ts` 统一日志（旧架构）

### API 调用规范

- ❌ 组件中禁止直接使用 `wx` API
- ✅ 统一通过服务层封装调用

### Git 提交

- 使用语义化提交信息
- 一个提交只做一件事
- 提交前确保 lint 和 type-check 通过

---

## 新增功能指南

### 新增页面

1. 在 `src/pages/` 下创建文件夹
2. 创建 `index.tsx`、`index.config.ts`、`index.scss`
3. 在 `src/app.config.ts` 的 `pages` 数组中注册路由
4. 如需要，在 `tabBar.list` 中添加 Tab

### 新增主题

1. 在 `src/utils/canvas/themes/` 下创建 JSON 文件
2. 定义 `frame` 和 `compose` 配置
3. 在 `themes` 集合中新增文档
4. 准备边框图片和预览图，上传至云存储

---

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `TARO_APP_API_BASE` | 后端 API 基础 URL | ✅ |
| `TARO_APP_MOCK_AUTH` | Mock 登录（开发用） | 开发调试时 |

API 基础 URL 由 `domain.config.js` 中的 `API_BASE` 编译时注入。

---

> **旧架构参考**: 云函数部署、CloudRun 配置等 CloudBase 相关内容已于 2026 年迁移至 Express REST API 后废弃。
> 当前仅需关注 `servers/ftg-server` 的开发与部署。PP-ShiTuV2 现通过 Docker Compose 独立编排。
