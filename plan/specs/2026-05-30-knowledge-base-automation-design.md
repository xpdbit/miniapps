# 自动化知识库系统设计

> 状态: implemented (Phase 1-2, Phase 5) | 更新: 2026-05-30

## 1. 概述

构建一个纯 SQLite 驱动的知识库系统，由 AI Agent 自动化维护。知识采集、萃取、写入、查询全链路自动化，人为查询也通过 Agent 中转。

### 核心目标

- **自动化扩展**: 知识库随项目演进自动生长，不需要人工整理
- **质量控制**: 三层机制保障（来源分级 + 3×Oracle 投票验证 + 时效检测）
- **通识优先**: 先覆盖设计模式、架构思想、工程文化等跨领域通识
- **Wiki 风格**: 双向链接、标签分类、全文搜索、变更历史

## 2. 数据架构

放弃文件系统作为数据源，采用 SQLite 作为**唯一数据源**。

```
knowledge/
├── knowledge.db          ← 唯一数据源
└── README.md             ← 简单说明
```

### 2.1 表结构

```sql
-- 页面主表
CREATE TABLE pages (
    id TEXT PRIMARY KEY,               -- frontend.design-tokens, general.design-patterns.creational
    title TEXT NOT NULL,
    domain TEXT NOT NULL,               -- frontend | general | backend | database | ...
    tags TEXT NOT NULL DEFAULT '',       -- 逗号分隔
    aliases TEXT,                        -- JSON 数组，用于查重匹配
    content TEXT NOT NULL,               -- Markdown 正文
    sources TEXT,                        -- JSON 数组，来源引用

    status TEXT NOT NULL DEFAULT 'verified',
        -- verified | auto-extracted | stale | rejected

    source_grade TEXT NOT NULL DEFAULT 'B',  -- S | A | B | C
    oracle_scores TEXT,                       -- JSON: [0.9, 0.8, 1.0]

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    verified_at TEXT
);

-- 全文搜索
CREATE VIRTUAL TABLE pages_fts USING fts5(
    title, tags, aliases, content,
    content=pages,
    tokenize='unicode61'
);

-- 变更历史（替代 git blame）
CREATE TABLE page_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL REFERENCES pages(id),
    changed_at TEXT NOT NULL,
    changed_by TEXT NOT NULL,          -- hook | cron | manual | agent
    diff_summary TEXT,
    prev_content_hash TEXT,
    new_content_hash TEXT
);

-- 双向链接（从 content 的 [[xxx]] 语法提取）
CREATE TABLE wiki_links (
    source_id TEXT NOT NULL REFERENCES pages(id),
    target_id TEXT NOT NULL REFERENCES pages(id),
    PRIMARY KEY (source_id, target_id)
);

-- 标签聚合视图
CREATE VIEW tag_summary AS
    SELECT t.tag, COUNT(*) AS cnt
    FROM pages, json_each('["' || replace(tags, ',', '","') || '"]') AS t
    GROUP BY t.tag ORDER BY cnt DESC;
```

### 2.2 索引设计

```sql
-- 按域查询
CREATE INDEX idx_pages_domain ON pages(domain);

-- 按状态查询（stale 检测）
CREATE INDEX idx_pages_status ON pages(status);

-- 按更新时间查询（近期新增）
CREATE INDEX idx_pages_updated ON pages(updated_at);
```

## 3. 知识范围规划

通识领域优先，按 P0→P4 顺序逐个子域注入：

| 优先级 | 域 | 子域 |
|--------|-----|------|
| P0 | general/design-patterns | 创建型 / 结构型 / 行为型 |
| P1 | general/architecture | 简洁架构 / DDD / 事件驱动 / CQRS |
| P2 | general/engineering-culture | Code Review / 技术债 / 事故响应 / 效能度量 |
| P3 | general/writing | 技术写作 / PR 描述 / 文档策略 |
| P4 | general/cognitive-bias | 规划谬误 / 自行车棚效应 / 确认偏误 |

**知识卡片规格**（每条记录 content 的 Markdown 结构）：

```markdown
## 核心概念
<!-- 200 字以内，一句话定义 + 展开说明 -->

## 使用场景
<!-- 什么情况下用，什么情况下不用 -->

## 注意事项
<!-- 常见误用、边界情况 -->

## 关联知识
<!-- 使用 [[双向链接]] 引用相关页面 -->
```

## 4. 来源可信度分级

| 等级 | 定义 | 处理方式 |
|------|------|---------|
| **S** | 官方规范、W3C/RFC、学术论文 | 可直接收录 |
| **A** | 知名开源项目、权威书籍 | 需标注来源，可直接收录 |
| **B** | 高质量博客、Stack Overflow 高赞 | 需交叉验证，标注出处 |
| **C** | AI 生成内容、无明确来源 | **必须有 S/A 锚点**，否则拒绝 |

### 分级逻辑

根据 sources 字段自动判定：

- 含 `w3.org`、`rfc-editor`、`doi.org`、`ieee` → S
- 含 `og`、`oreilly.com`、`manning.com`、知名出版社 ISBN → A
- 含个人博客、`stackoverflow.com`、`medium.com` → B
- 无 sources 或 sources 为空 → C

## 5. 自动化管线

### 5.1 三条流入路径

#### 路径①: Git Hook（被动捕获）

**触发器**: `post-merge` 钩子

**流程**:
1. 检测本次合并的 commits 中涉及的文件变更
2. 提取变更中的模式/约定（新 API 使用方式、项目结构变化）
3. 写入 DB 标记 `status=auto-extracted`，记录 `changed_by=hook`
4. 发起异步 3×Oracle 验证

**适用**: 浅层知识（项目约定、目录规范、配置规则）

#### 路径②: 定时研究（主动探索）

**触发器**: 每周 CI cron job

**流程**:
1. 查询当前知识库的 domain 覆盖情况
2. 按 P0→P4 优先级选择下一个未覆盖的子域
3. librarian agent 搜索该子域的最佳资料（官方文档 + 知名开源 + 行业权威）
4. 综合生成知识草案
5. 进入质量门（来源分级 → 3×Oracle 验证 → 写入）
6. 写入后重建索引

**适用**: 深度知识（新领域开拓、主题研究）

#### 路径③: 手动捕获（按需沉淀）

**触发器**: `pnpm knowledge:capture` 命令 / agent 主动调用

**流程**:
1. 交互式（或从命令行参数接收）主题、内容、来源
2. 直接进入质量门
3. 写入 DB

**适用**: 踩坑记录、架构决策、Code Review 中发现的模式

### 5.2 质量门（写入前必过）

```
         知识草案
            │
            ▼
    ┌───────────────┐
    │ 来源可信度分级  │  ← 第一层: 自动判定
    │  C 级无锚点 → 拒 │
    └───────┬───────┘
            │ 通过
            ▼
    ┌──────────────────────────────────────┐
    │         3×Oracle 并行验证             │
    │                                      │
    │  Oracle 1     Oracle 2     Oracle 3   │
    │  事实核查      一致性检查    时效+可验证 │
    │                                      │
    │  投票裁定:                             │
    │  3/3 通过 → 直接写入                   │
    │  2/3 通过 → 带警告写入                 │
    │  ≤1/3 通过 → 拒绝 + 记录原因           │
    └──────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │  写入 SQLite   │
    │  重建 FTS 索引 │
    │  提取 wiki 链接 │
    │  写入变更历史   │
    └───────────────┘
```

### 5.3 查重策略（入口处拦截）

写入前执行：

```sql
-- 精确匹配: 标题或别名完全匹配
SELECT id, title FROM pages WHERE title = ? OR aliases LIKE '%' || ? || '%' LIMIT 1;

-- 模糊匹配: FTS5 搜索
SELECT id, title, rank FROM pages_fts WHERE pages_fts MATCH ? LIMIT 3;
```

- 精确命中 → 追加到已有页面的 `## 补充参考` 章节
- FTS5 语义相似度 > 80% → 丢弃，记录"已存在，未收录"
- 无匹配 → 新建页面

## 6. 维护机制

### 6.1 时效性检测（Stale 检测）

定时任务扫描所有 `updated_at` 超过 90 天的页面，标记 `status=stale`。

Agent 查询时过滤 `status=stale` 的页面，并触发重新研究更新。

### 6.2 索引重建

以下事件触发全量索引重建：

- 每次知识写入后（增量重建 FTS）
- 每周定时（全量重建 wiki_links、tag_summary）

### 6.3 变更历史

`page_history` 表记录每一次变更，支持：

- 回溯任意页面的演变过程
- 通过 `diff_summary` 快速了解变更内容
- 支持回滚到任一历史版本

## 7. CLI 工具

配套轻量 CLI，供 Agent 和开发者使用：

```bash
# 查询知识
pnpm knowledge:query "单例模式"         # FTS5 搜索
pnpm knowledge:get general.design-patterns.creational

# 浏览
pnpm knowledge:list                    # 所有页面
pnpm knowledge:list --domain general   # 按领域筛选
pnpm knowledge:list --tag architecture # 按标签筛选
pnpm knowledge:graph                   # 引用图谱

# 写入（路径③ 手动触发）
pnpm knowledge:capture                 # 交互式

# 维护
pnpm knowledge:stale                   # 查过期知识
pnpm knowledge:export                  # 导出全量 markdown
pnpm knowledge:rebuild                 # 重建索引
```

## 8. 反模式与边界情况

### 8.1 反模式

| 反模式 | 说明 |
|--------|------|
| **知识越多越好的幻觉** | 每条知识都有 token 成本（查询/验证），宁缺毋滥 |
| **不标注来源** | 没有来源的知识不可验证，自动标记为 C 级 |
| **重复写入同一条** | 查重策略拦截；如果绕过了，变更历史可追溯 |

### 8.2 边界情况

| 场景 | 处理 |
|------|------|
| Oracle 验证结果不一致（1/3） | 拒绝并记录分歧，供人工审查 |
| FTS5 匹配到多条高相似度 | 选排名最高的，追加补充参考 |
| 来源链接失效 | 不影响已有内容，但标记 `stale` 待更新 |
| 知识库为空时的首次写入 | 跳过查重，直接进入质量门 |

## 9. 实施计划

```
Phase 1: 基础设施 ✅
  - [x] 创建 knowledge.db 及所有表结构
  - [x] 实现 knowledge:capture CLI
  - [x] 实现 knowledge:query / knowledge:get / knowledge:list
  - [x] 实现查重逻辑

Phase 2: 质量门 ✅
  - [x] 实现来源可信度分级
  - [ ] 实现 3×Oracle 并行验证编排（agent 工作流，依赖 OpenCode 生态）
  - [ ] 实现投票裁定逻辑（agent 工作流）

Phase 3: 自动化管道
  - [ ] 实现路径①: post-merge hook
  - [ ] 实现路径②: CI cron job + librarian 研究
  - [x] 实现路径③: knowledge:capture 完整交互

Phase 4: 维护与增强 ✅
  - [x] 实现 stale 检测
  - [x] 实现 wiki_links 自动提取
  - [x] 实现 knowledge:graph / knowledge:export / knowledge:rebuild

Phase 5: 内容填充
  - [ ] 通识 P0-P4 逐个注入（由定时研究路径完成）
  - [x] 已有 frontend 知识迁移到 SQLite (9 条)
```
