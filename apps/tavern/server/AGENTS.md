# -*- coding: utf-8 -*-
"""
tavern-server — AI-Tavern 后端服务
"""

# OVERVIEW
AI 角色聊天后端，SSE 流式聊天，通义千问/OpenAI/DeepSeek/OpenRouter 多 Provider，角色卡市场，AES-256-GCM API Key 加密，审核系统，V2 导入导出。

# STRUCTURE
```
apps/tavern/server/
├── src/
│   ├── app.ts                 # Express 入口
│   ├── index.ts               # 启动入口
│   ├── config/                # 环境变量 + 敏感词表
│   ├── lib/                   # JWT 工具
│   ├── middleware/             # 认证/错误处理/Zod 校验
│   ├── routes/                # 8 路由模块
│   ├── services/              # 10 服务模块
│   ├── types/                 # TS 类型定义
│   └── utils/                 # crypto/logger/prisma/response
└── prisma/
    └── schema.prisma          # 8 表
```

# WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 路由模块 | `src/routes/` | auth/characters/chat/keys/market/admin/builtin/export，挂载于 `/api/v1/*` |
| 核心服务 | `src/services/` | ai-proxy/character/context/export/key/market/moderation/persona/prompt-builder/social |
| 数据库模型 | `prisma/schema.prisma` | User/CharacterCard/ChatSession/ChatMessage/Persona/ApiKey/ModerationLog/点赞收藏 |
| SSE 流式聊天 | `src/services/ai-proxy.service.ts` | 多 Provider 流式输出封装 |
| API Key 加密 | `src/utils/crypto.ts` | AES-256-GCM 加密存储 |
| 认证中间件 | `src/middleware/auth.ts` | JWT 验证 |

# CONVENTIONS
同根目录：TypeScript strict，2 空格缩进，LF 换行，UTF-8，`@/*` 路径别名，Prisma ORM，独立 `npm install`。额外：Zod 参数校验，AES-256-GCM 加密 API Key，Helmet + rate-limit 安全中间件，SSE 流式响应。

# ANTI-PATTERNS
- ❌ **占位注释** — `src/routes/chat.ts:149` `// Clean up if needed` — 客户端断开处理未实现
- ❌ **CI 路径过滤器错误（3处）** — paths + working-directory + cache-dependency-path 均使用 `servers/tavern-server/`，实际路径 `apps/tavern/server/`，CI 永不触发
- ❌ **死路由文件** — `personas.ts` 和 `builtin.ts` 存在于 routes/ 但未被 routes/index.ts 导入
- ❌ **no-explicit-any: off** — 唯一关闭此规则的项目，类型检查最宽松
- ❌ **无 Prettier 配置** — 缺少 `.prettierrc`，其他 Server 项目已配置
