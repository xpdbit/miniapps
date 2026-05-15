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
- ❌ **占位注释** — `src/routes/chat.ts` line 149 `// Clean up if needed` — 客户端断开处理未实现
- ❌ **无 CI** — 无 GitHub Actions workflow，手动 npm scripts 部署
- ❌ **类型定义** — `no-explicit-any: off`，类型检查不如其他项目严格

# COMMANDS
```bash
npm run dev                # tsx watch 热重载
npm run build              # tsc 编译
npm run start              # 生产启动
npm run type-check         # 类型检查
npm run lint               # ESLint
npm run db:generate        # Prisma Client 生成
npm run db:migrate         # 数据库迁移
npm run db:seed            # 种子数据（内置角色）
```
