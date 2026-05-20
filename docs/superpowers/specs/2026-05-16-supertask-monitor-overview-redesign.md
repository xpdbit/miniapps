# SuperTask 监控概览 Tab 布局重新设计

**日期**: 2026-05-16
**状态**: 设计稿（待审批）
**涉及项目**: SuperTask (tools/supertask)

## 1. 目标

对 SuperTask 监控与统计面板中的「概览」Tab 进行布局美化与优化，解决以下问题：
- 统计卡片视觉平淡（PeriodStatsGrid 仅文本行+分隔线）
- 缺少图表可视化
- 信息密度不合理，一屏信息量不均衡

## 2. 设计原则

- **保持现有 GitHub Dark 风格**：#0d1117 主背景、#30363d 边框、#e6edf3 主文本
- **零冗余改动**：只重构 `OverviewTab`，不涉及其他 Tab
- **最小新依赖**：仅新增 `pyqtgraph` 用于趋势图
- **向后兼容**：数据接口不变，`MonitorInterface` 对 `OverviewTab` 的调用方式不变

## 3. 总体布局

```
┌──────────────────────────────────────────────────────────────┐
│  EnhancedStatusHeader (h=96px)                                │
│  ● 工作中  |  运行中进程: 3 / 总计: 5  |  今日会话: 12  成本: $0.42 │
├───────────────────────────────────┬──────────────────────────┤
│  左面板 (stretch=3, 约 60%)       │  右面板 (stretch=2, 约 40%) │
│                                   │                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──┐│  ┌───────────────────────┐│
│  │ 耗时  │ │ Token │ │ 会话  │ │成本│  │ 实时 Agent 追踪       ││
│  │ 1h23m │ │45.2K  │ │  12   │ │0.42│  │ (卡片列表, 非表格)    ││
│  │ +5%↑  │ │ -2%↓  │ │ +3↑   │ │+8%│  │                       ││
│  └──────┘ └──────┘ └──────┘ └──┘│  │ ● explore  00:02:31    ││
│                                   │  │ ● oracle   00:01:05    ││
│  ┌──────────────────────────────┐│  │ ● sisyphus 00:05:12    ││
│  │  7日趋势图 (PyQtGraph)        ││  ├───────────────────────┤│
│  │  [会话▼] [Token] [成本] [耗时] ││  │ Agent 分布 (水平条形图)  ││
│  │                               ││  │ explore ████████  8    ││
│  │     ╱╲     ╱╲                ││  │ oracle  ██████    6    ││
│  │    ╱  ╲   ╱  ╲    ╱╲        ││  │ libr.   ████      4    ││
│  │   ╱    ╲ ╱    ╲  ╱  ╲       ││  ├───────────────────────┤│
│  │ 05/10     ...      05/16     ││  │ 今日摘要               ││
│  └──────────────────────────────┘│  │ 主会话:3  子Agent:9    ││
│                                   │  │ Token入/出: 28K/17K    ││
├───────────────────────────────────┴──────────────────────────┤
│  (底部可选: 近期活动摘要 3-5 条)                               │
└──────────────────────────────────────────────────────────────┘
```

## 4. 组件设计

### 4.1 EnhancedStatusHeader

替换现有的 `StatusHeader`（72px → 96px 高度）。

**布局** (QHBoxLayout):
```
[● 状态指示灯 + 文本] | [运行中进程数] | [今日会话 + 今日成本]
```

- 左侧：状态圆点（绿=工作中/灰=待机）+ 状态文本 + 子状态描述（保持现有逻辑）
- 中列：大号运行中进程数 + "运行中进程" 标签 + 下方小字 "总计 X 个进程"
- 右列：今日会话数（大号）+ "今日会话" 标签 + 下方 "今日成本 $X.XX"
- 分隔线使用 `QFrame.VLine`，颜色 `#21262d`

**样式**:
- 背景: `#0d1117` + 微弱的径向渐变 overlay（`#161b22` 到透明）
- 边框: `1px solid #30363d`，圆角 10px
- 间距: padding 20px 左右，内容间距 16px

### 4.2 KPI Card (新组件)

替换 PeriodStatsGrid 的 4 行文本。

**每张卡片规格**:
- 尺寸: 固定宽度，`~23%` 父容器，固定高度 90px
- 背景: `#161b22`
- 顶部 3px 彩色边框（accent color）
- 圆角 8px
- padding: 12px

**内容**:
- 左上小字标签（11px, accent color）：指标名称
- 中部巨大数值（24px, bold, #e6edf3）：当日值
- 右下变化指示（11px）：与昨日对比百分比 + 箭头
  - 上升 = `#3fb950` 绿色 + `↑`
  - 下降 = `#f85149` 红色 + `↓`

**4 张卡片的 accent 颜色**:
| 卡片 | Accent | 格式函数 |
|------|--------|----------|
| 耗时 | `#f0883e` 橙 | `_fmt_duration` |
| Token | `#58a6ff` 蓝 | `_fmt_tokens` |
| 会话 | `#3fb950` 绿 | 直接数字 |
| 成本 | `#d29922` 金 | `_fmt_cost` |

### 4.3 TrendChart (新组件, PyQtGraph)

7 日趋势折线图。

**规格**:
- 最小高度: 200px
- 背景: `#0d1117`（透明）
- 边框: `1px solid #30363d`，圆角 10px
- padding: 16px

**功能**:
- 顶部标题 "7日趋势" + 4 个切换按钮（`QPushButton` 扁平风格）
  - 按钮：无边框，hover 时高亮，active 时填充 accent color
  - 选项：会话数 / Token / 成本 / 耗时
- 图表区域（PyQtGraph `PlotWidget`）：
  - X 轴：最近 7 天日期（MM-DD 格式）
  - Y 轴：自动缩放，网格线浅灰
  - 曲线：单条实线，颜色 = 当前选中指标对应的 accent color
  - 数据点：小圆点标记
  - 禁用鼠标交互（只读展示）
  - 背景透明，与父容器融合

**数据来源**:
- `MonitorStore.get_daily_aggregates(days=7)` 返回每日列表
- 按日期排序后提取对应字段

**切换逻辑**:
- 点击按钮 → 清除旧曲线 → 重新绘制新数据 → 调整 Y 轴范围

### 4.4 AgentCardList (新组件, 替换 LiveAgentPanel)

将实时 Agent 追踪从表格改为卡片列表风格。

**规格**:
- 背景: `#161b22`
- 边框: `1px solid #30363d`，圆角 10px
- padding: 14px
- 最大高度: 自适应，撑满右栏上半部分

**头部**:
- "实时 Agent 追踪" 标题（左侧）
- "N 运行中 / M 总计" 计数标签（右侧）
- 底部 1px 分隔线

**每行 Agent 卡片**:
```
┌─────────────────────────────────────────┐
│ ● explore   model: deepseek...          │
│             ⏱ 00:02:31  💰 $0.01      │
├─────────────────────────────────────────┤
│ ● oracle    model: deepseek-v4-pro      │
│             ⏱ 00:01:05  💰 $0.08      │
└─────────────────────────────────────────┘
```

- 状态圆点：运行中=`#3fb950`，已退出=`#8b949e`
- Agent 名称（`StrongBodyLabel` 13px）
- 模型名（小字 11px, `#8b949e`）
- 耗时 + 成本右对齐

无 Agent 时显示空状态："暂无运行中的 Agent"

### 4.5 AgentDistBar (新组件)

Agent 类型分布的水平条形图。

**规格**:
- 背景: `#161b22`
- 边框: `1px solid #30363d`，圆角 10px
- padding: 14px

**内容**:
- 标题 "Agent 分布"
- 4-5 行水平条形，每行：
  - Agent 类型名称（左对齐, 12px）
  - 彩色条形（QPainter 绘制，使用 `#58a6ff`）
  - 会话次数（右对齐, 12px）
- 条形长度按最大值为基准缩放

**数据来源**:
- `MonitorStore.get_agent_type_usage(days=7)` 取前 5 条

### 4.6 DailySummary (新组件)

今日关键数字摘要。

**规格**:
- 背景: `#161b22`
- 边框: `1px solid #30363d`，圆角 10px
- padding: 14px

**内容**:
- 标题 "今日摘要"
- 3 行关键数字：
  - 主会话 / 子 Agent
  - Token 入 / Token 出
  - 文件变更数

## 5. 数据流程

### 5.1 初始化

```
MonitorInterface.set_data_sources()
  └─ OverviewTab.set_data_sources()  — 传递 monitor_store 引用
```

### 5.2 自动刷新 (60s 间隔)

```
MonitorInterface._auto_refresh_overview()
  ├─ MonitorStore.get_summary(days=1)    → KPI cards + header
  ├─ MonitorStore.get_summary(days=7)    → (用于计算变化百分比)
  ├─ MonitorStore.get_daily_aggregates(days=7) → TrendChart
  ├─ MonitorStore.get_agent_type_usage(days=7) → AgentDistBar
  └─ OverviewTab.update_stats()          → 批量更新
```

### 5.3 进程数据（实时推送）

```
ProcessMonitor 后台线程 → _on_process_data()
  └─ QTimer.singleShot → _apply_process_data()
       ├─ ProcessesTab.update_processes()
       └─ OverviewTab.update_live_agents()
            ├─ AgentCardList.update_processes()
            └─ EnhancedStatusHeader.update_status()
```

### 5.4 全量刷新

```
MonitorInterface._do_refresh_all()
  ├─ 同步 opencode DB → 更新本地 SQLite
  └─ 各 tab 分别拉取最新数据
```

## 6. 依赖变更

### requirements.txt

新增:
```
pyqtgraph>=0.13
```

PyQtGraph 是轻量级纯 Python 图表库（无额外系统依赖），与 PyQt6 原生兼容。

## 7. 接口兼容性

`MonitorInterface` 对 `OverviewTab` 的使用方式不变：

```python
# 不变的方法签名
overview_tab.update_stats(day, week, month, total)  # → 更新 KPI 卡片
overview_tab.update_live_agents(processes)           # → 更新 AgentCardList
overview_tab.set_on_refresh(callback)                # → 不变
overview_tab.set_data_sources(store)                 # → 新增（传递 store 引用）
```

## 8. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `gui/ui_pyqt/monitor_interface.py` | 修改 | 重写 OverviewTab；新增 5 个组件；保留其他 Tab 不变 |
| `requirements.txt` | 修改 | 添加 `pyqtgraph>=0.13` |
| `gui/core/monitor_store.py` | 不改 | 现有查询接口已满足需求 |

## 9. 未纳入范围

- ❌ 不涉及「会话分析」「Agent 分析」「模型统计」「日报表」「实时进程」等 Tab
- ❌ 不改变数据持久化层（monitor_store.py）
- ❌ 不添加交互式图表功能（缩放/拖拽/选区）
- ❌ 不重构整体配色方案
