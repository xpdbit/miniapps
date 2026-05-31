# tools/local_server — 本地开发环境

> **迁移来源**: 原 `local_server/` 从项目根目录迁移至 `tools/local_server/`。

一键启动本地开发环境：Docker 基础设施（MySQL + Redis）+ 各服务热重载。

## 快速启动

```bash
# 方式 1：根目录 BAT 启动器
.\local_dev.bat

# 方式 2：直接启动 Docker 基础设施
.\tools\local_server\start-all.ps1
```

BAT 启动器会打开 Python TUI 控制台，提供菜单操作：

| 选项 | 功能 |
|------|------|
| [1] 启动基础设施 | Docker Compose 启动 MySQL (3307) + Redis (6379) |
| [2] 停止基础设施 | Docker Compose down |
| [3] 启动所有服务 | 在 Windows Terminal 多标签页启动各个服务，自动保存日志 |
| [4] 重启所有服务 | 先 taskkill node.exe，再重新启动 |
| [5] 清理缓存与日志 | 清理 `.playwright-mcp/`、`tmp/`、日志文件 |
| [6] 配置启动服务项 | 选择要启动的服务（方向键 + Space 多选） |
| [7] 杀死占用进程 | 杀死占用服务端口的进程 |
| [8] 重新编译 | 编译所选服务 |

## 文件结构

```
tools/local_server/
├── .env                     # Docker Compose 环境变量
├── docker-compose.yml       # MySQL 8.0 + Redis 7
├── init/
│   └── 01-create-dbs.sql    # 首次启动自动创建 4 个数据库
├── dev_console.py           # Python TUI 控制台（主逻辑）
├── local_dev.py             # TUI 启动器（委托 dev_console.py）
├── start-all.ps1            # Docker 基础设施一键启动
├── stop-all.ps1             # Docker 基础设施停止
├── log-runner.js            # Node.js 日志包装器（ANSI 剥离 + 文件日志）
├── service_config.json      # 启用的服务列表
└── logs/                    # 服务运行日志
    ├── Dashboard_Admin/
    ├── Dashboard_Front/
    ├── Tavern_H5_Web/
    └── Tavern_Server/
```

## 管理服务

在控制台 [6] 中可以选择启用/禁用以下服务：

| 服务 | 目录 | 端口 | 命令 |
|------|------|------|------|
| FTG Server | `apps/ftg/server` | 3000 | `npm run dev` |
| Game1 Server | `apps/game1/server` | 3004 | `npm run dev` |
| Tavern Server | `apps/tavern/server` | 3002 | `npm run dev` |
| Dashboard Admin | `dashboard` | 3001 | `npm run dev:admin` |
| Dashboard Front | `dashboard` | 5173 | `npm run dev` |
| Tavern H5 Web | `apps/tavern/client` | 5174 | `npm run dev:web` |

## Docker 基础设施

| 服务 | 镜像 | 端口 | 默认用户 |
|------|------|------|----------|
| MySQL | mysql:8.0 | 3307 | `dev_user` / `dev_pass_123` |
| Redis | redis:7-alpine | 6379 | 无密码 |

数据库初始化自动创建：`food_theme_generator`、`game1`、`ai_tavern`、`miniapps`。

## 常见操作

```powershell
# 查看 Docker 日志
docker compose -f .\tools\local_server\docker-compose.yml logs -f

# 停止并保留数据
.\tools\local_server\stop-all.ps1

# 停止并清空数据（谨慎）
docker compose -f .\tools\local_server\docker-compose.yml down -v
```

## 入口（根目录 BAT）

- `local_dev.bat` — 唯一推荐的入口，自动调用 `tools/local_server/local_dev.py`

---

> **状态**: current
> **更新**: 2026-05-29
