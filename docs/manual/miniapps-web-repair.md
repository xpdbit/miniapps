# Miniapps Web 修复手册

> **用途**: Agent 对整体 Web 服务进行测试与修复的操作手册
> **状态**: current
> **更新**: 2026-05-27
> **注意**: 禁止内部执行CLI，这很可能导致OpenCode会话卡住！

---

## 速查

| 项目 | 值 |
|------|-----|
| 本地启动命令 | `python local_server/local_dev.py` → `[6]` 启动所有服务 |
| ECS 服务器 | `ssh root@mnapp.top` (47.94.108.150) |
| Docker 部署目录 | `/opt/ftg/deploy/` |
| 本地日志目录 | `local_server/logs/` |

### 服务端口总览

| 服务 | 端口 | 本地启动 | ECS 容器名 |
|------|------|----------|------------|
| MySQL | 3307(本地)/6606(ECS) | Docker | `docker-mysql` |
| Redis | 6379 | Docker | `redis` |
| FTG Server | 3000 | `cd apps/ftg/server && npm run dev` | `ftg-server` |
| Game1 Server | 3004 | `cd apps/game1/server && npm run dev` | `game1-server` |
| Tavern Server | 3002 | `cd apps/tavern/server && npm run dev` | `tavern-server` |
| Dashboard Admin API | 3001 | `cd dashboard && npm run dev:admin` | `dashboard-api` |
| Dashboard Front | 5173 | `cd dashboard && npm run dev` | (Nginx 托管) |
| Nginx | 80/443 | — | `docker-nginx` |

---

## 1. 本地环境健康检查

### 1.1 基础设施检查

```bash
# Docker 容器是否运行
docker ps --format 'table {{.Names}}\t{{.Status}}'

# MySQL 可连接
npx prisma db push --schema prisma/schema-miniapps.prisma --accept-data-loss

# Redis 可连接
redis-cli -h localhost -p 6379 ping  # 应返回 PONG
```

### 1.2 各服务健康端点

```bash
# FTG Server
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health
# 预期: 200

# Game1 Server
curl -s -o /dev/null -w '%{http_code}' http://localhost:3004/health
# 预期: 200

# Tavern Server
curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/health
# 预期: 200

# Dashboard Admin API
curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health
# 预期: 200

# Dashboard Front
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173
# 预期: 200
```

### 1.3 统一检查脚本

```bash
$ports = @{3000="FTG";3002="Tavern";3004="Game1";3001="Admin";5173="Front"}
$ports.Keys | ForEach-Object {
  try {
    $r = curl -s -o /dev/null -w '%{http_code}' "http://localhost:$_"
    if ($r -eq "200") { Write-Host "✅ Port $_ ($($ports[$_])): $r" -ForegroundColor Green }
    else { Write-Host "⚠️  Port $_ ($($ports[$_])): $r" -ForegroundColor Yellow }
  } catch { Write-Host "❌ Port $_ ($($ports[$_])): Unreachable" -ForegroundColor Red }
}
```

---

## 2. 日志检查

### 2.1 本地开发日志

```bash
# 检查所有服务日志中的错误
Get-ChildItem local_server\logs\*\*.log | ForEach-Object {
  $errors = Select-String -Path $_.FullName -Pattern "proxy error|ECONNREFUSED|Error|500|Cannot find module|SyntaxError"
  if ($errors) {
    Write-Host "❌ $($_.Name): $($errors.Count) errors"
    $errors | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
  }
}

# 检查特定服务的日志
Get-ChildItem local_server\logs\Dashboard_Front\*.log | Select-String "proxy error|ECONNREFUSED"
Get-ChildItem local_server\logs\Tavern_Server\*.log | Select-String "Error|error|Unhandled"
```

### 2.2 ECS 生产日志

```bash
ssh root@mnapp.top "
  # 检查所有容器状态
  docker ps --format 'table {{.Names}}\t{{.Status}}'

  # 检查每个容器的最近错误日志
  for container in tavern-server dashboard-api ftg-server; do
    echo \"=== \$container ===\"
    docker logs --tail 20 \$container 2>&1 | grep -i 'error\|Error\|ECONNREFUSED' || echo '  No errors'
  done

  # 磁盘空间
  df -h /
"
```

---

## 3. 常见故障模式

### 3.1 端口冲突

**现象**: 启动服务时报 `EADDRINUSE` 或端口被占用

**排查**:
```bash
# 查看占用端口的进程
netstat -ano | Select-String ":3000|:3001|:3002|:3004|:5173"

# 强制释放（替换端口号）
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```

### 3.2 数据库连接失败

**现象**: 服务启动后立即退出，日志含 `Can't connect to MySQL`

**排查**:
```bash
# 检查 Docker MySQL 状态
docker ps --filter name=mysql

# 检查连接串
Get-Content apps/ftg/server/.env | Select-String "DATABASE_URL"

# 测试直连
mysql -h localhost -P 3307 -u ftg_user -p
```

### 3.3 Prisma 模型不匹配

**现象**: API 返回 500，日志含 `PrismaClientKnownRequestError` 或模型字段错误

**修复**:
```bash
cd apps/ftg/server && npm run db:generate   # 重新生成 Client
cd apps/ftg/server && npm run db:migrate    # 执行新迁移
```

### 3.4 跨域 / 代理错误

**现象**: 前端页面加载但 API 请求失败，日志含 `CORS` 或 `proxy error`

**排查**:
```bash
# 检查 Dashboard Vite 代理配置
Get-Content dashboard/vite.config.ts | Select-String "'/api"

# 确认目标服务已启动
curl -s http://localhost:3000/health
```

### 3.5 npm 依赖缺失

**现象**: `Cannot find module` 错误

**修复**:
```bash
# 在对应的项目目录重新安装
cd apps/tavern/server && npm install
```

---

## 4. ECS 部署排查

### 4.1 容器级问题

```bash
ssh root@mnapp.top "
  # 容器是否在运行
  docker ps --filter status=running

  # 容器是否已退出
  docker ps --filter status=exited

  # 查看退出容器的日志
  docker logs \$(docker ps -q --filter status=exited | head -1) --tail 50

  # 重启服务
  docker restart tavern-server
"
```

### 4.2 健康检查

```bash
ssh root@mnapp.top "
  # 内部健康检查
  curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/health
  curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health

  # 外部健康检查（经过 Nginx）
  curl -s -o /dev/null -w '%{http_code}' https://mnapp.top/api/tavern/health
  curl -s -o /dev/null -w '%{http_code}' https://mnapp.top/api/v1/admin/health
"
```

### 4.3 磁盘与资源

```bash
ssh root@mnapp.top "
  df -h /
  docker system df
  free -h
"
```

---

## 5. 快速修复命令集

| 问题 | 命令 |
|------|------|
| 重启所有服务 | `ssh root@mnapp.top "cd /opt/ftg/deploy && docker compose restart"` |
| 重建单个容器 | `ssh root@mnapp.top "cd /opt/ftg/deploy && docker compose up -d --build tavern-server"` |
| docker cp 热更新 | `scp file.ts root@mnapp.top:/opt/ftg/... && ssh root@mnapp.top "docker cp ... && docker restart ..."` |
| 查看实时日志 | `ssh root@mnapp.top "docker logs -f --tail 50 tavern-server"` |
| 清理 Docker 缓存 | `ssh root@mnapp.top "docker system prune -f"` |

---

## 6. 前端检查与修正

> **适用范围**: Dashboard 管理后台（React 19 + Vite + Ant Design）  
> **前端开发端口**: Vite Dev Server (5173) | Admin API (3001) | Tavern H5 (5174)

### 6.1 前端进程健康检查

Dashboard 是双进程架构，需要 Vite 前端 + Express Admin API 同时运行。

```bash
# 检查 Vite 前端端口
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173
# 预期: 200（返回 HTML 页面）

# 检查 Admin API
curl -s http://localhost:3001/health
# 预期: {"status":"ok"} 或类似 JSON

# PowerShell 统一检查
@"
Vite Front (5173): $(try { curl -s -o /dev/null -w '%{http_code}' http://localhost:5173 } catch { 'Unreachable' })
Admin API (3001):  $(try { curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health } catch { 'Unreachable' })
Tavern H5 (5174):  $(try { curl -s -o /dev/null -w '%{http_code}' http://localhost:5174 } catch { 'Unreachable' })
"@
```

**Dashboard 启动顺序**（确认两个进程都在运行）：
```bash
# 窗口 1: Vite 开发服务器
cd dashboard && npm run dev

# 窗口 2: Admin API 服务
cd dashboard && npm run dev:admin
```

### 6.2 代码质量检查

```bash
# Dashboard 类型检查（tsc --noEmit，严格模式）
cd dashboard && npm run type-check

# Dashboard ESLint 检查
cd dashboard && npm run lint

# Dashboard 生产构建（验证能否正常打包）
cd dashboard && npm run build

# Taro 客户端类型检查（微信小程序 + H5）
cd apps/tavern/client && npm run type-check
cd apps/game1/client && npm run type-check
cd apps/ftg/client && npm run type-check
```

### 6.3 页面渲染检查

```bash
# 使用 curl 检查 Dashboard 关键页面是否能正常加载（返回 HTML，非空白/500）

# 登录页
curl -s http://localhost:5173/login | Select-String -Pattern "root" -Quiet
# 预期: True（页面有挂载点 #app）

# 仪表盘（需确保 Admin API 也在运行）
curl -s http://localhost:5173/dashboard | Select-String -Pattern "root" -Quiet

# 检查页面是否有 JS 加载错误（通过检查控制台模拟）
# Vite 开发模式下，页面 500 错误会在终端输出
```

**人工检查清单**（浏览器打开）：
| 页面 | URL | 检查要点 |
|------|-----|----------|
| 登录页 | `http://localhost:5173/login` | 表单渲染、无白屏 |
| 仪表盘 | `http://localhost:5173/dashboard` | 数据加载、无网络错误 |
| 监控页 | `http://localhost:5173/monitoring` | 服务状态显示 |
| 用户管理 | `http://localhost:5173/users` | 表格渲染 |
| Tavern 管理 | `http://localhost:5173/tavern` | Tab 切换 |

### 6.4 API 代理检查

Dashboard Vite 通过代理规则将 `/api/*` 转发到各后端服务。代理配置在 `dashboard/vite.config.ts`。

```bash
# 验证代理规则按预期工作

# Admin API 代理（→ 3001）
curl -s http://localhost:5173/api/admin/health
# 实际转发到 http://localhost:3001/health

# Tavern 代理（→ 3002，路径重写 /api/tavern → /api）
curl -s http://localhost:5173/api/tavern/health
# 实际转发到 http://localhost:3002/api/health

# Game1 代理（→ 3004）
curl -s http://localhost:5173/api/v1/game1/health
# 实际转发到 http://localhost:3004/api/v1/game1/health

# 通用 API 代理（→ 3000 ftg-server）
curl -s http://localhost:5173/api/v1/health
# 实际转发到 http://localhost:3000/api/v1/health
```

**代理顺序敏感性**：`vite.config.ts` 中代理规则按定义顺序匹配。更具体的规则（如 `/api/admin`）必须放在通用规则（如 `/api`）之前。

```bash
# 快速验证所有代理路径
@$paths = @{
  "/api/admin/health" = "Admin API"
  "/api/auth/login" = "Auth"
  "/api/tavern/health" = "Tavern"
  "/api/v1/game1/health" = "Game1"
  "/api/v1/health" = "FTG"
}
$paths.Keys | ForEach-Object {
  try {
    $r = curl -s -o /dev/null -w '%{http_code}' "http://localhost:5173$_"
    Write-Host "$r → $_ ($($paths[$_]))"
  } catch { Write-Host "❌ $_ ($($paths[$_])): Unreachable" }
}
```

### 6.5 构建产物检查

```bash
# Dashboard 构建后验证
cd dashboard

# 构建成功（dist/ 目录应包含 index.html + JS/CSS 资源）
npm run build

# 验证关键文件存在
Test-Path dist/index.html
Test-Path dist/assets/*.js
Test-Path dist/assets/*.css

# 验证 HTML 引用了正确的资源文件
Get-Content dist/index.html | Select-String -Pattern "script.*src" | ForEach-Object { $_.Line.Trim() }

# Taro H5 构建
cd apps/tavern/client && npm run build:h5:prod
# 输出在 dist-h5/ 目录
Test-Path dist-h5/index.html

cd apps/game1/client && npm run build:h5:prod
# 输出在 dist/ 目录（game1 的 H5 构建产物）
```

### 6.6 桌面与移动布局人性化验证

Dashboard 采用响应式布局，通过 `useMobile(1024)` 在桌面（>=1024px）和移动（<1024px）间切换 UI 模式。修改布局组件后须验证两种视图。

#### 6.6.1 桌面布局验证

**布局结构**（宽度 >=1024px）：
```
┌──────────────────────────────────────────────────────┐
│  顶栏: [项目切换器]  [总览] [配置] [监控] [用户管理]   │  ← 水平导航栏
├────────┬─────────────────────────────────────────────┤
│ 侧栏   │  内容区                                      │
│ 220px  │  padding: 24px                              │
│ (暗色)  │  <Outlet />                                 │
│        │                                              │
│ 项目   │                                              │
│ 菜单   │                                              │
└────────┴──────────────────────────────────────────────┘
```

**人工验证清单**（浏览器窗口 >=1024px）：

| 检查项 | 预期表现 | 常见问题 |
|--------|----------|----------|
| 水平导航菜单 | 显示"总览/配置/监控/用户管理"四个入口 | 导航项溢出或换行 |
| 项目切换器 | 点击展开项目下拉列表 | 下拉列表被裁切 |
| 侧栏显示 | 深色侧栏 220px，含项目名和菜单项 | 侧栏缺失或宽度异常 |
| 侧栏菜单过滤 | 切换项目后菜单项根据 scope 刷新 | 菜单未随项目变化 |
| 内容区 padding | 内容与边界间距 24px | 内容贴边 |
| 暗色/亮色模式 | 主题切换后全局应用 | 部分组件未跟随主题 |
| 退出按钮文字 | 显示"退出"文字 | 文字被隐藏或截断 |
| 用户昵称 | 顶栏右侧显示当前用户昵称 | 昵称缺失 |
| 侧栏 sticky | 页面滚动时侧栏固定 | 侧栏随页面滚动 |

#### 6.6.2 移动布局验证

**布局结构**（宽度 <1024px）：
```
┌─────────────────────┐
│ ☰  [项目切换器]   🌙 🚪│  ← 顶栏紧凑模式
├──────────────────────┤
│                      │
│   内容区              │  ← 无侧栏
│   padding: 12px      │
│                      │
│                      │
└──────────────────────┘

点击 ☰ 打开抽屉:
┌─────────────────────┐
│ 导航菜单            │  ← Drawer 260px
│ ─────────────────── │
│ 总览                │
│ 配置                │
│ 监控                │
│ 用户管理            │
└─────────────────────┘
```

**人工验证清单**（浏览器窗口 <1024px，或使用 DevTools 设备模拟）：

| 检查项 | 预期表现 | 常见问题 |
|--------|----------|----------|
| 顶栏紧凑 | padding 缩小为 12px，高度 56px | 顶栏元素重叠 |
| 汉堡菜单 | 左侧显示 ☰ 按钮，替代水平导航 | 按钮未出现或不可点击 |
| 侧栏隐藏 | 页面无 220px 深色侧栏 | 侧栏在小屏仍显示 |
| 抽屉导航 | 点击 ☰ 打开左侧 Drawer 260px | Drawer 宽度异常或空内容 |
| 导航点击跳转 | 点击抽屉菜单后 Drawer 自动关闭 | Drawer 不关闭或跳转失败 |
| 内容区紧凑 | padding 缩小为 12px | 内容撑破容器 |
| 退出按钮仅图标 | 退出按钮不显示文字 | 文字仍显示导致布局拥挤 |
| 用户昵称隐藏 | 顶栏右侧不显示昵称 | 昵称仍显示占用空间 |
| 表格横向滚动 | 宽表格在窄屏可左右滑动 | 表格被截断或变形 |
| Modal/Drawer 全宽 | Modal 宽度 100%，Drawer 全宽 | Modal 在移动端显示桌面宽度 |

#### 6.6.3 模拟测试方法

```bash
# 浏览器 DevTools 快速切换设备模拟
# Chrome: F12 → Toggle Device Toolbar (Ctrl+Shift+M)
# 预设设备: iPhone 12/14 (390px), iPad (768px), Desktop (1440px)

# 关键断点验证
#   <576px:  手机竖屏（antd xs）
#   576-768px: 手机横屏 / 小平板（antd sm）
#   768-1024px: 平板竖屏（antd md）
#   >=1024px: 桌面（Dashboard 移动/桌面切换点）
```

**测试要点**：
1. **关键流程走通**：在移动视图下完成"登录 → 切换项目 → 查看页面 → 退出"全流程
2. **无溢出/滚动条**：页面内容不产生意外的水平滚动条
3. **表单可操作**：输入框、下拉选择、按钮在窄屏可正常点击
4. **数据表格响应**：表格列不重叠，横向滚动流畅
5. **暗色模式保持**：切换暗色模式后所有元素正常渲染
6. **Taro H5 页面**：若 Tavern/Game1 H5 页面有修改，同样需验证移动端布局

#### 6.6.4 响应式布局变量参考

Dashboard 响应式设计涉及的常量定义在 `dashboard/src/constants/layout.ts` 和 `dashboard/src/hooks/`：

```typescript
// layout.ts
export const DRAWER_WIDTH = { mobile: '100%', desktop: 600 }
export const MODAL_WIDTH = { mobile: '100%', desktop: 520 }
export const DRAWER_WIDTH_WIDE = { mobile: '100%', desktop: 680 }

// hooks/useMobile.ts — 断点检测
const useMobile = (breakpoint = 576): boolean  // Layout 中使用 1024

// hooks/useResponsiveWidth.ts — 响应式宽度工具
export function useResponsiveWidth(config): string
```

修改这些常量会影响全局响应式行为，修改后须完整验证 §6.6.1 + §6.6.2 清单。

---

## 7. 常见前端故障模式

### 7.1 TypeScript 类型错误

**现象**: `npm run type-check` 报错，或 Vite 开发模式下终端显示 TS 错误

**Dashboard 特有规则**（严格模式）：
| 规则 | 说明 |
|------|------|
| `noUnusedLocals: true` | 未使用变量 → 报错 |
| `noUnusedParameters: true` | 未使用参数 → 报错 |
| `verbatimModuleSyntax: true` | 必须显式使用 `type` import |
| `noUncheckedIndexedAccess: true` | 索引访问必须处理 undefined |
| `no-explicit-any: error` | 禁止 `any` 类型 |

**修复**:
```bash
# 自动修复 ESLint 问题
cd dashboard && npx eslint src --fix

# 查找未使用的变量/导入（可能有多个文件）
cd dashboard && npx tsc --noEmit 2>&1 | Select-String "is declared but its value is never read"
```

### 7.2 模块加载失败 / 白屏

**现象**: 浏览器访问页面空白，控制台报 `Failed to load module` 或 `Uncaught SyntaxError`

**排查**:
```bash
# Vite 终端输出通常有明确的错误栈，查看 terminal 输出

# 检查依赖是否完整
cd dashboard && npm ls --depth=0

# 清理 Vite 缓存
rm -r node_modules/.vite; if ($?) { cd dashboard && npm run dev }

# 重新安装依赖
cd dashboard && rm -r node_modules package-lock.json; if ($?) { npm install }
```

### 7.3 Vite 代理 404

**现象**: 前端页面加载但 API 全部 404，日志无后端错误

**排查**:
```bash
# 确认代理目标服务已启动
curl -s http://localhost:3001/health
curl -s http://localhost:3002/health
curl -s http://localhost:3004/health
curl -s http://localhost:3000/health

# 检查代理规则顺序（vite.config.ts）
Get-Content dashboard/vite.config.ts | Select-String -Pattern "^      '/api"

# 规则必须按 具体→通用 排列:
#   /api/admin(3001) > /api/auth(3001) > /api/tavern(3002) > /api/v1/game1(3004) > /api(3000)
```

### 7.4 Ant Design 版本兼容警告

**现象**: 控制台输出 `[antd: compatible]` 或 `[antd: message] Static function` 警告

Dashboard `main.tsx` 已内置抑制逻辑，这些是 React 19 + antd v5 的已知兼容性问题，**不影响功能**，生产构建时不存在。

如果出现非预期的 antd 错误：
```bash
# 检查 antd 版本是否兼容 React 19
npm ls antd react

# 当前兼容版本:
# antd: ^5.24.7
# react: ^19.1.0
```

### 7.5 React 渲染问题

**现象**: 页面闪烁、组件重复挂载、无限 re-render

**排查**:
```bash
# 检查 React StrictMode 导致的双次渲染（开发模式下正常行为）
# 在 main.tsx 中包裹了 <React.StrictMode>，开发环境会双重渲染以检测副作用

# 检查 useEffect 依赖数组
# 常见问题: 依赖缺失导致无限循环、闭包陷阱
```

**常见模式与修复**:

| 问题 | 原因 | 修复 |
|------|------|------|
| 无限 re-render | `useEffect` 依赖为对象/数组字面量 | 用 `useMemo` 包裹或提取为常量 |
| 页面闪烁 | Suspense fallback 频繁切换 | 使用 `PageSkeleton` 组件替代简单 Skeleton |
| 状态不同步 | Zustand store 在组件外访问 | 使用 hook `useXxxStore()` 访问 |
| 401 弹窗 | apiClient 收到 Server (3000) 的 401 | 已在 interceptors 中静默处理，勿修改 |

### 7.6 Taro H5 构建失败

**现象**: Taro 项目 H5 构建失败

**排查**:
```bash
# 检查 Taro 版本一致性（所有客户端项目需统一版本）
node -e "console.log(require('@tarojs/cli/package.json').version)"
# 预期: 4.0.13

# 清理构建缓存
cd apps/tavern/client && rm -r dist-h5 .swc; if ($?) { npm run build:h5 }

# 检查环境变量（API_BASE 编译时注入）
# Taro 通过 TARO_APP_* 环境变量在编译时注入
Get-Content apps/tavern/client/.env.h5 2>$null

# 检查 H5 入口 HTML
Get-Content apps/tavern/client/index.html | Select-String -Pattern "root|app"
```

---

## 8. 快速修复命令集（前端）

| 问题 | 命令 |
|------|------|
| Dashboard 类型检查 | `cd dashboard && npm run type-check` |
| Dashboard ESLint 修复 | `cd dashboard && npm run lint` |
| Dashboard 生产构建 | `cd dashboard && npm run build` |
| 清理 Vite 缓存 | `rm -r node_modules/.vite` 后重启 `npm run dev` |
| 重新安装 Dashboard 依赖 | `cd dashboard && rm -r node_modules package-lock.json; if ($?) { npm install }` |
| Tavern H5 开发构建 | `cd apps/tavern/client && npm run dev:h5:local` |
| Tavern H5 生产构建 | `cd apps/tavern/client && npm run build:h5:prod` |
| Game1 H5 开发构建 | `cd apps/game1/client && npm run dev:h5` |
| Game1 H5 生产构建 | `cd apps/game1/client && npm run build:h5:prod` |
| FTG H5 开发构建 | `cd apps/ftg/client && npm run dev:h5` |
| Taro 类型检查（全项目） | `cd apps/tavern/client && npm run type-check` |

---

## 9. 验证清单（前端补充）

每次修改前端代码后，在原有验证清单基础上增加：

- [ ] `npm run type-check` 通过（无 TS 错误）
- [ ] `npm run lint` 通过（无 ESLint 错误）
- [ ] Vite 开发服务器启动无报错
- [ ] 浏览器打开修改页面，无白屏/404/500
- [ ] API 代理验证：改动的代理规则 curl 测试通过（§6.4）
- [ ] 生产构建 `npm run build` 通过（改构建配置后）
- [ ] Taro H5 构建通过（改 Taro 客户端后）
- [ ] **桌面布局验证**（≥1024px）：侧栏显示、导航菜单完整、内容间距正常（§6.6.1）
- [ ] **移动布局验证**（<1024px）：汉堡菜单可用、侧栏隐藏、内容不溢出（§6.6.2）
- [ ] **关键断点检查**：分别测试 390px（手机）、768px（平板）、1440px（桌面）
- [ ] **暗色模式兼容**：在桌面和移动视图下分别切换暗色模式

---

> **Agent 提示**: 从 §1 开始按顺序检查。发现故障后参考 §3 / §7 定位根因，使用 §5 / §8 修复命令。每次修复后回到 §1.2 确认恢复。前端问题优先执行 `type-check` 和 `lint` 快速定位。
