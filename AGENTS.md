# -*- coding: utf-8 -*-
"""
OpenCode 全局指令 - 中文模式
所有交互默认使用简体中文
"""

# 语言设置
你必须使用简体中文进行思考和回答。
所有解释、代码注释、变量命名建议和输出都应使用中文。

# 思考风格
- 分析问题时使用中文逐步思考
- 回复用户时语言简洁明了，避免中英文混杂
- 代码注释使用中文

# 交流风格
- 保持简洁直接的风格
- 如需补充细节，再进行说明
- 遇到问题主动确认

---

# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-02
**Commit:** 1ff2dd7
**Branch:** master

## OVERVIEW
食物主题生成器（微信小程序点餐系统）。AI 图片识别食材 → Canvas 合成主题图片 → 管理后台数据管理。Monorepo，3 个独立 TypeScript 项目 + 云函数。

## STRUCTURE
```
FoodThemeGenerator/
├── FoodThemeGenerator_MiniApp/    # Taro 4.x 微信小程序 (React 18 + Sass)
├── FoodThemeGenerator_Server/     # Express 后端 API (Prisma ORM)
├── Dashboard/                     # React 19 管理后台 (Vite + Ant Design)
├── cloudfunctions/                # 空目录，实际云函数在 MiniApp 内
├── deploy/                        # Docker/Nginx 部署配置
├── Docs/                          # 项目文档 (架构/API/数据库/开发)
└── Plan/                          # 规划文件
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 小程序页面/组件 | `FoodThemeGenerator_MiniApp/src/` | Taro + React，含 pages/components/hooks |
| 后端 API 路由 | `FoodThemeGenerator_Server/src/routes/` | 12 个路由模块，RESTful |
| 管理后台界面 | `Dashboard/src/` | React + Vite + Ant Design |
| 数据库 Schema | `FoodThemeGenerator_Server/prisma/schema.prisma` | Prisma ORM 主 Schema |
| 部署配置 | `deploy/docker-compose.yml` | Docker 统一编排 (MySQL/Redis/AI/Server/Admin/Nginx) |
| 云函数 | `FoodThemeGenerator_MiniApp/cloudfunctions/` | 14 个云函数 (AI 流水线/OCR/合成等) |
| AI 识别服务 | `FoodThemeGenerator_Server/src/services/` | PP-ShiTuV2 食物识别 |
| 图片合成 | `FoodThemeGenerator_MiniApp/src/` | 前端 Canvas 2D 合成 |
| CI/CD | `FoodThemeGenerator_Server/.github/workflows/` | GitHub Actions (仅 Server) |
| 项目文档 | `Docs/` | ARCHITECTURE / API / DATABASE / DEVELOPMENT |

## CODE MAP
| 符号 | 类型 | 位置 | 角色 |
|------|------|------|------|
| `App` (MiniApp) | 入口 | `FoodThemeGenerator_MiniApp/src/app.ts` | 小程序应用入口 |
| `App` (Server) | 入口 | `FoodThemeGenerator_Server/src/app.ts` | 后端 Express 服务 |
| `main` (Dashboard) | 入口 | `Dashboard/src/main.tsx` | 管理后台 SPA 入口 |
| `server` (Dashboard API) | 入口 | `Dashboard/server/server.ts` | Admin 独立 API (3001端口) |
| `orchestrateAIPipeline` | 云函数 | `cloudfunctions/orchestrateAIPipeline/` | AI 流水线编排 |
| `themeCompose` | 云函数 | `cloudfunctions/themeCompose/` | 主题图片合成 |

## CONVENTIONS
- **TypeScript strict** 全项目强制 (`no-explicit-any: error`)
- **2 空格缩进**，LF 换行，UTF-8
- **路径别名** `@/*` → 各项目 `src/`
- **Dashboard 额外规则**: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`
- **Prisma** 统一 ORM (Server v5.22, Dashboard v6.19)
- **无 monorepo workspace** — 各项目独立 `npm install`

## ANTI-PATTERNS (本项目)
- ❌ **零测试覆盖** — 全项目无测试框架/文件/脚本
- ❌ `textGenerate` 云函数为占位实现（未接入混元 AI）
- ❌ `getUserStats` 云函数返回硬编码零值
- ❌ 存在无必要的 `eslint-disable` 注释
- ❌ `cloudfunctions/` 根目录为空，云函数实际在 MiniApp 子目录下

## COMMANDS
```bash
# MiniApp (Taro) — cd FoodThemeGenerator_MiniApp
npm run dev:weapp        # 开发模式 (watch)
npm run build:weapp      # 生产构建
npm run type-check       # TypeScript 类型检查

# Server (Express) — cd FoodThemeGenerator_Server
npm run dev              # tsx watch 开发 (端口 env.PORT)
npm run build            # tsc 编译
npm run lint             # ESLint
npm run db:migrate       # Prisma 数据库迁移

# Dashboard (Vite) — cd Dashboard
npm run dev              # Vite 开发 (5173端口)
npm run build            # 生产构建
npm run type-check       # TypeScript 类型检查
npm run db:generate      # Prisma Client 生成

# 部署
bash deploy/scripts/deploy.sh   # 一键构建+部署到 ECS
bash deploy/scripts/verify.sh   # 部署后健康检查
```

## NOTES
- **Dashboard 双进程**: Vite 前端(5173) + Express Admin API(3001) 独立运行
- **`.FoodThemeGenerator_MiniAPP/`** 为 MiniApp 旧版副本，忽略
- **API 代理**: Dashboard `/api` 在开发时代理到 Server `localhost:3000`
- **生产架构**: Nginx(80/443) → Dashboard SPA / API(/api/v1/) / 识别(/recognition/*)
- **识别服务**: PP-ShiTuV2 独立容器，通过 HTTP API 调用