# Knowledge Tool — 自动化知识库

> 位置: `tools/knowledge/` | 状态: v0.1 | 更新: 2026-05-30

## 概述

SQLite 驱动的知识库系统，由 AI Agent 自动化维护。取代了传统的文件式知识管理，采用 `knowledge.db` 作为唯一数据源。

## 架构

```
tools/knowledge/
├── package.json           # 依赖: better-sqlite3
├── bin/knowledge.js       # CLI 入口
└── src/
    ├── db.js              # 数据库 Schema + CRUD + FTS5 + 来源分级
    ├── migrate.js          # 从文件迁移到 SQLite
    └── cleanup.js          # 数据清理工具
```

## CLI 命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `query <词>` | FTS5 全文搜索 | `npm run knowledge query 无障碍` |
| `get <id>` | 查看单条详情 | `npm run knowledge get frontend.前端无障碍` |
| `list` | 列出所有条目 | `npm run knowledge list --domain=frontend` |
| `capture` | 写入新知识 | `echo '{"title":"..."}' \| npm run knowledge capture` |
| `stale` | 查看过期知识 | `npm run knowledge stale` |
| `graph` | 查看引用图谱 | `npm run knowledge graph` |
| `rebuild` | 重建索引 | `npm run knowledge rebuild` |
| `export` | 导出为 Markdown | `npm run knowledge export --dir=./export` |

## 数据流

```
Agent 写入 → 查重 → 来源分级 → 3×Oracle 验证 → SQLite
                                                      ↓
Git Hook  → 变更捕获 → 异步验证  → SQLite          FTS5 索引
                                                      ↓
定时研究  → librarian 搜索 → 分级 → Oracle 验证 → SQLite  查询
```

## 表结构

- `pages` — 知识主表（id, title, domain, tags, aliases, content, sources, status, source_grade, oracle_scores）
- `pages_fts` — FTS5 全文搜索虚拟表
- `page_history` — 变更历史（替代 git blame）
- `wiki_links` — 双向链接（从 `[[xxx]]` 语法提取）
- `tag_summary` — 标签聚合视图

## 相关文档

- [设计 Spec](../../../plan/specs/2026-05-30-knowledge-base-automation-design.md)
- [知识库索引](../../../knowledge/INDEX.md)
