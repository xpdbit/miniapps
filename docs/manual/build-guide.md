# 项目构建指南

> **用途**: Agent 构建、运行或排查构建问题时参考。
> **状态**: current
> **最后更新**: 2026-05-24 (从 `.opencode/commands/` 迁移至 `docs/manual/`)
> **原则**: 本文档仅描述通用模式与规则，不绑定具体项目名称。每个项目的具体配置参见各子目录下的 `AGENTS.md`。

---

## 项目结构约定

```
.miniapps/
├── apps/{project}/client/    ← Taro 4.x 小程序 (weapp + H5)
├── apps/{project}/server/    ← Express 后端 (TypeScript + Prisma)
├── dashboard/                ← React 管理后台 (Vite + Admin API 双进程)
├── tools/                    ← 独立工具（Python 等）
└── deploy/                   ← Docker Compose 统一部署
```

所有 `apps/` 下的 `client/` 和 `server/` 遵循相同模式。以下按**项目类型**组织，不涉及具体项目名。

---

## 1. Taro 小程序客户端

`apps/{project}/client/` 下所有项目构建方式一致。

### 命令

```bash
# 开发（watch 热重载）
npm run dev:weapp        # 编译 weapp 到 dist-weapp/ + 持续监听
npm run dev:h5           # 编译 H5 到 dist-h5/ + 持续监听

# 一次性构建
npm run build:weapp      # weapp 开发版 → dist-weapp/
npm run build:weapp:prod # weapp 生产版 → dist-weapp/
npm run build:h5         # H5 开发版 → dist-h5/
npm run build:h5:prod    # H5 生产版 → dist-h5/

# 验证
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
```

### ⭐ 分平台输出目录（避免覆盖）

weapp 和 H5 编译产物**共享同一套源码**但输出到**不同目录**，由 `project.config.json` 的 `miniprogramRoot` 指定开发者工具读取的目录。

| 构建类型 | 输出目录 | 配置来源 |
|---------|---------|---------|
| weapp | `dist-weapp/` | `config/index.ts` → `mini.outputRoot` |
| H5 | `dist-h5/` | `config/index.ts` → `h5.outputRoot` |

**规则：**
- 两个平台可以任意顺序构建、并行构建，互不覆盖
- `predev` 脚本自动根据 `dev:weapp`/`dev:h5` 清理对应目录
- 微信开发者工具始终读取 `dist-weapp/`，不受 H5 构建影响
- 构建产物中的图标（tabBar icons）分别复制到各平台输出目录

### ⭐ 微信开发者工具打开路径

Taro weapp 编译产物在 `dist-weapp/`，但开发者工具**不能直接选 `dist-weapp/` 作为项目目录**。

```
正确做法：
  开发者工具 → 导入项目 → 选择 apps/{project}/client（含 project.config.json 的目录）
                           └── miniprogramRoot 自动指向 dist-weapp/

错误做法：
  ❌ 直接选 dist-weapp/ → 报"未找到 app.json"（project.config.json 在父目录）
  ❌ 未先运行 dev:weapp → dist-weapp/ 不存在或内容不完整
  ❌ 错误选择了 dist-h5/ → H5 产物不含 app.json
```

### weapp 构建产物结构

构建成功后 `dist-weapp/` 至少包含：`app.json`、`app.js`、`app.wxss`、`pages/`、`components/`。

### API 地址配置

由 `.miniapps/domain.config.js` 统一管理，编译时注入 `process.env.TARO_APP_API_BASE`。环境变量可覆盖：`TARO_APP_API_BASE=xxx npm run dev:weapp`。

---

## 2. Express 后端服务

`apps/{project}/server/` 下所有项目：Express + TypeScript + Prisma。

### 命令

```bash
npm run dev             # tsx watch 热重载
npm run build           # tsc 编译到 dist/
npm run start           # 生产启动

npm run type-check      # 类型检查
npm run lint            # ESLint

npm run db:generate     # Prisma Client 生成（改 schema 后必须执行）
npm run db:migrate      # 数据库迁移
npm run db:seed         # 种子数据
```

### 启动前必做

1. `npm install`
2. 检查 `.env` 中 `DATABASE_URL` 是否配置
3. `npm run db:generate`
4. 必要时 `npm run db:migrate`

### 结构约定

- 入口: `src/app.ts` 或 `src/index.ts`
- 路由: `src/routes/`
- 业务逻辑: `src/services/`
- 中间件: `src/middleware/`

---

## 3. Dashboard 管理后台

双进程架构：**Vite 前端(:5173) + Express Admin API(:3001)**，开发时需同时启动。

### 命令

```bash
npm run dev             # Vite 前端 → localhost:5173
npm run dev:admin        # Admin API → localhost:3001（需另开终端）

npm run build           # tsc + vite build
npm run type-check
npm run db:generate     # Prisma Client
```

### 注意事项

- Vite 开发时将 `/api` 代理到本地后端服务
- 前端页面空白 → 通常是 Admin API 未启动
- 非 monorepo workspace，必须在 `dashboard/` 内执行 `npm install`

---

## 4. Docker 部署

所有服务通过 `deploy/docker-compose.yml` 统一编排，Nginx 统一反向代理。

### 部署命令

```bash
cp deploy/.env.example deploy/.env   # 配置密钥
bash deploy/scripts/deploy.sh        # 一键部署
bash deploy/scripts/verify.sh        # 健康检查

# 手动操作
cd deploy
docker compose --env-file .env up -d
docker compose --env-file .env ps
docker compose --env-file .env logs -f
```

### 服务容器

| 类型 | 说明 |
|------|------|
| MySQL + Redis | 数据基础设施 |
| 各 `*-server` 容器 | 对应 `apps/{project}/server` 后端 |
| admin 容器 | Dashboard Admin API |
| nginx 容器 | 统一入口，按路径前缀分发到各后端 |

---

## 5. 常见问题速查

| 问题 | 原因 | 解决 |
|------|------|------|
| 微信开发者工具报"未找到 app.json" | 路径选错或 dist-weapp/ 为空/H5 产物 | 打开 client 根目录，先跑 `dev:weapp` |
| weapp 构建产物跑到 `dist/` | 项目未配置分平台输出目录 | 检查 `config/index.ts` 中 `mini.outputRoot` 和 `h5.outputRoot` |
| `dist-weapp/` 无 `app.json` | 跑了 `build:h5` 而非 `build:weapp` | 确认命令含 `--type weapp` |
| `Taro.login()` H5 下失败 | H5 不支持微信登录 | 自动降级 Mock（检查服务端是否支持 `dev_` 前缀 code）|
| `prisma generate` 报路径错 | 各项目 schema 路径不同 | 检查 `package.json` 中 `db:generate` 脚本的 `--schema` 参数 |
| `npm install` 后异常 | 非 workspace，从根目录安装无效 | 在子项目目录内单独 `npm install` |
| VS Code TS 报错但命令行通过 | IDE tsconfig 不匹配 | 在子项目目录打开 IDE |
| 构建 weapp 报别名错误 | Taro config 缺少 alias | 检查 `config/index.ts` → `mini.webpackChain` |
| Prisma Client 版本不匹配 | 未重新生成 | `npm run db:generate` |

---

## 6. 快速决策（Agent 用）

```
需要做什么？
├── 构建/运行小程序客户端
│   ├── cd apps/{project}/client
│   ├── npm install（首次）
│   ├── npm run dev:weapp（weapp）/ npm run dev:h5（H5）← 可并行
│   ├── 两种构建互不覆盖，输出到独立目录
│   └── weapp: 开发者工具打开 client 根目录（miniprogramRoot→dist-weapp/）
│
├── 构建/运行后端服务
│   ├── cd apps/{project}/server
│   ├── npm install + 配置 .env
│   ├── npm run db:generate
│   └── npm run dev
│
├── 运行 Dashboard
│   ├── cd dashboard
│   ├── npm install + npm run db:generate
│   └── 终端1: npm run dev / 终端2: npm run dev:admin
│
├── Docker 部署
│   ├── cd deploy
│   ├── 配置 .env
│   └── bash scripts/deploy.sh
│
└── 验证代码质量
    ├── npm run type-check
    └── npm run lint
```
