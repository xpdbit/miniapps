# Knowledge Base

> 状态: current | 更新: 2026-05-30

SQLite 驱动的 AI 维护知识库。数据存储在 `knowledge/knowledge.db`，CLI 工具位于 `tools/knowledge/`。

## 导航

| 领域 | 说明 |
|------|------|
| frontend | 设计系统、布局、组件、动效、无障碍、性能、CSS 架构 |

## 快速使用

```bash
# 搜索知识
npm run knowledge query <关键词>
# 例: npm run knowledge query 无障碍

# 列出知识
npm run knowledge list
npm run knowledge list --domain=frontend
npm run knowledge list --tag=architecture

# 查看单条
npm run knowledge get <page-id>

# 写入新知识（管道模式，供 Agent 使用）
echo '{"title":"...","domain":"...","content":"..."}' | npm run knowledge capture

# 查看过期知识
npm run knowledge stale

# 重建索引
npm run knowledge rebuild
```

## 知识范围

| 领域 | 条目 | 状态 |
|------|------|------|
| frontend | 设计系统、布局、组件、动效、无障碍、性能、CSS 架构、UX 状态、Taro H5 | ✅ verified |
| general (coming) | 设计模式、架构思想、工程文化、通识 | 📅 planned |

## 维护

- 知识写入自动经过查重 + 来源分级 + 3×Oracle 验证
- Agent 通过 `knowledge capture` 管道模式写入
- 90 天未更新自动标记 `stale`
- CLI 直接操作 SQLite，无需维护文件
- 详细机制见 [spec](../plan/specs/2026-05-30-knowledge-base-automation-design.md)
