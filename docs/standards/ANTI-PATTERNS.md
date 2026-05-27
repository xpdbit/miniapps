# 反模式列表

> **状态**: current
> **更新**: 2026-05-27
> 从 `AGENTS.md` 迁出的完整反模式。新增反模式请追加到此文件。

## 当前反模式

- ❌ **零测试覆盖** — 全项目无测试框架/文件/脚本（game1-miniapp 有 vitest.config 但无测试文件）
- ❌ **Tavern CI 路径过滤器错误（3处）** — `.github/workflows/ci.yml` 的 paths、working-directory、cache-dependency-path 均使用 `servers/tavern-server/`，实际路径 `apps/tavern/server/`。同时分支监听 `master/develop`，仓库实际使用 `main`，双重原因导致 CI 永不触发
- ❌ **FTG Server CI 缺路径过滤器** — 未限制 `apps/ftg/server/**`，其他目录变更也会触发
- ❌ **SSH 部署被注释** — `deploy.yml` SSH 部署步骤完全注释，仅做 Docker build+push
- ❌ **`textGenerate` 云函数为占位实现** — 未接入混元 AI
- ❌ **`getUserStats` 云函数返回硬编码零值**
- ❌ **空 catch 块** — `apps/ftg/client/src/app.ts` 有 4 个空 catch 块（line 55/94/117/131）
- ❌ **Mock 降级代码** — 多处运行时降级（recognition.mockRecognize, textgen.generateFallback, authStore.mockAuth）
- ❌ **TODO 占位实现** — `apps/ftg/client/src/pages/result/index.tsx:108` handleSave 未完成
- ❌ **占位注释** — `apps/tavern/server/src/routes/chat.ts:149` `// Clean up if needed` 无实际逻辑
- ❌ **错误日志缺失** — `apps/game1/server/src/routes/players.ts` catch 块仅 `sendError` 无日志
- ❌ **console.log 残留** — game1/client 多个文件（app.tsx、AchievementEngine、SaveManager、PendingEventEngine）
- ❌ **Prisma 版本分化** — ftg-server/dashboard v6.19, game1-server v5.22, tavern-server v5.10
- ❌ **tavern-server 路径别名未使用** — tsconfig 已有 `@/*` 配置，但实际 import 仍使用相对路径
- ❌ **Dashboard 内联样式过多** — 仅 Login/Dashboard/Layout 已迁移 CSS Modules，其余待迁移
- ❌ **cloud-functions/ 根目录为空** — 云函数实际在 apps/ftg/client/cloudfunctions/
- ❌ **tavern-server 无独立 Prettier 配置**
- ❌ **Game1 Client 无 CI/CD** — Server 有 GitHub Actions 但 MiniApp 没有
- ❌ **Grafana 容器名拼写错误** — `apps/ftg/server/docker-compose.monitoring.yml` 中 `container_name: ftp-grafana` 应为 `ftg-grafana`
- ❌ **game1-server Dockerfile 不一致** — 生产阶段使用 `node:20-alpine`（其他 server 用 `node:20-slim`），且缺少 healthcheck
- ❌ **dashboard docker-compose 不完整** — `dashboard/docker-compose.yml` 仅构建前端，缺少 Admin API 服务
- ❌ **tavern-server 死路由文件** — `personas.ts` 和 `builtin.ts` 存在于 routes/ 但未被 routes/index.ts 导入
- ❌ **Dashboard 无 ESLint 配置** — 最严格的项目反而缺失
- ❌ **Game1 Client 无 lint 脚本** — package.json 有 eslint 但 scripts 中 lint 指向缺失的 eslint config

## 已清理的旧反模式

以下已确认不存在（已修复）：

- ✅ `as any` 散布 — 源码中未发现
- ✅ `@ts-ignore` / `@ts-expect-error` — 未发现
- ✅ 无必要的 `eslint-disable` 注释 — 未发现
- ✅ 硬编码密钥 — `.sisyphus/aliyun-mysql-clear.js` 已处理

---

> 最后更新: 2026-05-27
