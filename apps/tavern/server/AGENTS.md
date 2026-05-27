# tavern-server — AI-Tavern 后端服务

## OVERVIEW
AI 角色聊天后端，SSE 流式聊天，通义千问/OpenAI/DeepSeek/OpenRouter 多 Provider。角色卡市场、用户等级系统、模型自动发现、AES-256-GCM API Key 加密、内容审核、V2 导入导出。

## STRUCTURE
```
apps/tavern/server/
├── src/
│   ├── app.ts                 # Express 应用定义（createServer() 工厂函数）
│   ├── index.ts               # 启动入口
│   ├── config/                # 环境变量 + 模型配置
│   ├── lib/                   # JWT 工具
│   ├── middleware/             # 认证/错误处理/Zod 校验
│   ├── routes/                # 14 路由模块
│   ├── services/              # 14 服务模块
│   ├── types/                 # TS 类型定义
│   └── utils/                 # crypto/logger/prisma/response
└── prisma/
    └── schema.prisma          # 13 表（含 UserTier/ModelMeta/CardReport/CardTag）
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 路由模块 | `src/routes/` | auth/characters/chat/keys/market/admin/export/tier/official/ai/personas/upload/reports，挂载于 `/api/v1/*` |
| 核心服务 | `src/services/` | ai-proxy/character/context/export/key/market/moderation/persona/prompt-builder/social/tier/model-discovery/model-sync |
| 数据库模型 | `prisma/schema.prisma` | TavernUser/Card/CharacterCard/ChatSession/ChatMessage/Persona/ApiKey/ModerationLog/Like/Follow/UserTier/ModelMeta/CardVersion 等 |
| SSE 流式聊天 | `src/services/ai-proxy.service.ts` | 多 Provider 流式输出封装 |
| AI 直连代理 | `src/routes/ai.ts` | 中转/直连 AI 生成端点 `POST /api/v1/ai/generate` |
| 模型发现 | `src/services/model-discovery.service.ts` | 自动探测各 Provider 可用模型列表 |
| 等级系统 | `src/routes/tier.ts` + `src/services/tier.service.ts` | 用户等级管理 (FREE/PAID/TESTER) |
| API Key 加密 | `src/utils/crypto.ts` | AES-256-GCM 加密存储 |
| 认证中间件 | `src/middleware/auth.ts` | JWT 验证 + uuid 用户引用 |

## CONVENTIONS
同根目录：TypeScript strict，2 空格缩进，LF 换行，UTF-8，`@/*` 路径别名，Prisma ORM，独立 `npm install`。额外：Zod 参数校验，AES-256-GCM 加密 API Key，Helmet + rate-limit 安全中间件，SSE 流式响应，uuid 用户引用（非自增 ID）。
- **CORS**: `CORS_ORIGIN` 环境变量支持逗号分隔多来源（如 `http://localhost:5173,http://localhost:5174`），分别用于 Dashboard 和 Tavern H5 前端。部署时需确保包含所有前端域名。

## ANTI-PATTERNS
- ❌ **占位注释** — `src/routes/chat.ts:149` `// Clean up if needed` — 客户端断开处理未实现
- ❌ **CI 路径过滤器错误（3处）** — paths + working-directory + cache-dependency-path 均使用 `servers/tavern-server/`，实际路径 `apps/tavern/server/`，CI 永不触发
- ❌ **死路由文件** — `personas.ts` 和 `builtin.ts` 存在于 routes/ 但未被 routes/index.ts 导入
- ❌ **no-explicit-any: off** — 唯一关闭此规则的项目，类型检查最宽松
- ❌ **无 Prettier 配置** — 缺少 `.prettierrc`，其他 Server 项目已配置
