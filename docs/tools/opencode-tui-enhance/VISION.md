# OCE 远景规划 — OpenCode 稳定性补丁层的闭环

> 本文档记录 OCE 的长期演进设想。核心命题：**如何让 OpenCode + DeepSeek v4 在不可靠的底座上可靠运行。**

---

## 一、核心定位

### OCE 是什么

**OpenCode 的稳定性补丁层** — 不替代 OpenCode 的编排能力，而是在其之上补足中断检测、堵塞恢复、误判回滚三个缺口。

### OCE 不是什么

| 角色 | 说明 |
|------|------|
| ❌ 不是 OpenCode 替代品 | 不重新实现 agent 编排，只做稳定性担保 |
| ❌ 不是自动化开发平台 | Loop Engine / 定向迭代是可选功能，不是核心价值 |
| ❌ 不是 IDE 插件 | 独立桌面 GUI，与 OpenCode 进程共存 |

---

## 二、解决的问题

### 2.1 OpenCode + DSv4 的三类故障

```
故障类型         触发场景               当前表现           OCE 当前处理
──────────      ─────────              ──────────         ────────────
中断 (Crash)    DSv4 长推理超时        session 断开        process_monitor 可检测，不可恢复
                subagent OOM          父 session 卡住      巡检到但无行动
                底层 provider 429      链式失败            supervisor 空告警

堵塞 (Stall)    subagent 无限循环      整条链无输出        可检测（5min 阈值），不可干预
                file watcher hang      进度条不动          `_check_process_stale` 空实现
                IPC deadlock           子进程僵尸          psutil 能扫到僵尸，不处理

误判 (Drift)    中间 agent 错误结论    后续叠加错误        state_manager 存了轮次但无回滚
                上下文丢失              code diff 退化     可对比但不自动 revert
                幻觉决策               引入无关变更        diff 分析检出但无防御
```

OCE 的架构本质上是为这三类故障搭建的**监控→检测→告警→恢复**管道。目前管道的前三段（监控/检测/告警）已建设，**恢复段（act）为空**。

### 2.2 看门狗闭环的缺失

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│   监控 (See)       │     │   检测 (Know)      │     │   干预 (Act)       │
│                   │     │                   │     │                   │
│ psutil 扫进程      │ →  │ 5min 无输出=僵死   │ →  │ ❌ 空实现          │
│ DB 查 session      │     │ 连续 3 次失败=熔断  │     │ ❌ 无 kill/resume  │
│ message 活跃度     │     │ 磁盘 <5GB=WARN     │     │ ❌ 无自动恢复      │
└───────────────────┘     └───────────────────┘     └───────────────────┘
                          supervisor.py            _check_process_stale()
                          _check_failure_counter()  方法体为空
```

---

## 三、演化路线

```
阶段 1（当前）    →    阶段 2（看门狗闭环）    →    阶段 3（Agent 恢复层）
─────────────────────────────────────────────────────────────────────────
能看不能打              detect → alert → act       自动恢复 + 误判回滚
GUI 监控为主             CLI 看门狗独立运行          深集成 OpenCode session
```

### 阶段 1：GUI 监控 + 告警（当前）

**现状痛点**：
- `_check_process_stale()` 空方法
- `_check_failure_counter()` 空方法
- 检测到问题只能闪状态栏，不能 kill 僵尸进程
- 巡检间隔 10 分钟太长，DSv4 的堵塞 30s 就能感知

**完成条件**：
- [ ] `_check_process_stale` 实现：调用 `_kill_zombie()` 
- [ ] `_check_failure_counter` 实现：超阈值时自动熔断
- [ ] 巡检间隔配置化（当前硬编码 600s/3600s）
- [ ] 告警→钉钉/飞书 webhook 通知

### 阶段 2：看门狗闭环（detect → alert → act）

**关键变更**：看门狗从「PyQt6 窗口内的一个后台线程」解耦为**独立 CLI 守护进程**。

```
OCE GUI（仪表盘）                    oce-watchdog（独立进程）
┌─────────────────────┐             ┌──────────────────────────┐
│ 概览 / 会话监控     │             │ supervisor 巡检逻辑      │
│ Token 趋势图        │  共享 DB    │ detect → alert → act     │
│ 日志面板            │ ◄───────── │ kill zombie              │
│ 设置编辑            │    读取     │ resume stalled task      │
└─────────────────────┘             │ webhook 通知             │
                                    │ 无 GUI 依赖              │
                                    │ systemd / winsw 托管     │
                                    └──────────────────────────┘
```

**`oce-watchdog` CLI 能力**：

| 命令 | 功能 |
|------|------|
| `oce-watchdog start` | 启动后台守护进程（detach） |
| `oce-watchdog stop` | 停止守护进程 |
| `oce-watchdog status` | 查看当前巡检状态 |
| `oce-watchdog check` | 单次巡检，立即输出 |
| `oce-watchdog kill <pid>` | 手动 kill 僵尸进程 |

**巡检策略优化**（对标 DSv4 特征）：

| 巡检项 | 当前 | 目标 |
|--------|------|------|
| 进程僵死检测 | 600s | **30s**（DSv4 卡住很快感知） |
| 通信活跃度 | 20s 阈值 | 30s + 可配置 |
| 连续失败熔断 | 2 次 | 3 次 + 指数退避 |
| 磁盘告警 | 5GB | 不变 |
| 日志轮转 | 100MB | 不变 |

### 阶段 3：Agent 恢复层

**问题**：当前即使检测到僵死，也只能 kill 进程。kill 后 OpenCode 没有机制从断点继续。

**解法**：在 `state_manager` 的基础上建立恢复管道。

```
detect(zombie) → kill(pid) → read(checkpoint) → resume(session)
     ↑                               ↓
  supervisor                  state_manager(YAML)
                                 ↓
                          opencode run --resume session_id
```

**checkpoint 增强**：

| 当前 | 目标 |
|------|------|
| 每轮 diff 存 YAML | 存完整 session context（prompt + 已有输出 + 文件变更） |
| 仅手工恢复 | 自动检测 + 自动 resume |
| 无版本化 | checkpoint 分级保存，支持回退到 N 轮前 |
| 单项目 | 跨项目 checkpoint 隔离 |

---

## 四、关键演进方向

### 4.1 看门狗独立化（阶段 2 核心）

**现状**：`supervisor.py` 是 `OceWindow` 的成员，巡检逻辑与 GUI 生命周期耦合。

**目标**：抽取 `supervisor` 为无 GUI 依赖的独立模块，提供 CLI 入口。

```
tools/opencode-tui-enhance/
├── src/
│   ├── opencode_tui_plus/
│   │   ├── gui/          # GUI 保持不动
│   │   ├── core/         # 核心模块（与看门狗共享）
│   │   │   ├── supervisor.py       # 巡检逻辑（抽取后不依赖 Qt）
│   │   │   ├── process_monitor.py  # 共享
│   │   │   └── opencode_db_reader.py # 共享
│   │   └── main.py       # GUI 入口
│   └── oce_watchdog/
│       └── main.py       # CLI 入口，复用 core/supervisor.py
```

**架构变更**：
- `supervisor.py` 移除 `OceWindow` 依赖（`on_alert` 回调改为抽象接口）
- 新增 `CLIAlertHandler`（写日志 + webhook）和 `GUIAlertHandler`（状态栏）
- 巡检配置从 `program.ocp` 改为独立 `watchdog.yaml`

### 4.2 巡检策略可配置

**现状**：阈值全部硬编码在 `supervisor.py` 类常量中。

**目标**：`watchdog.yaml` 完全控制巡检行为。

```yaml
# watchdog.yaml
intervals:
  fast_seconds: 30          # 进程巡检间隔
  slow_seconds: 300         # 资源巡检间隔

thresholds:
  process_stale_seconds: 300   # 僵死判定
  consecutive_failure_limit: 3 # 熔断阈值
  disk_warn_gb: 5
  disk_error_gb: 1
  log_max_mb: 100

actions:
  on_stale: "kill"           # kill | alert | ignore
  on_failure: "pause"        # pause | alert | ignore
  webhook_url: ""            # 非空时启用 webhook 通知
```

### 4.3 session 级超时传播

**现状**：OpenCode subagent 之间没有超时传播，一个子 agent 卡死父 agent 不感知。

**目标**：OCE 在 process 层面做看门狗——检测到子进程无输出超阈值时，kill 该子进程并通知父进程。

```
subagent A → stuck (无输出 60s)
                ↓
process_monitor 检测到 comm_elapsed > 60s
                ↓
supervisor 判定为 stale
                ↓
kill(subagent_A_pid)
                ↓
父 session 收到 exit code ≠ 0 → 触发重试/回滚
```

### 4.4 误判回滚

**现状**：`state_manager` 每轮存 diff，但无法自动识别退化的改动。

**目标**：引入 diff 退化检测，自动回滚到最近有效 checkpoint。

```python
# 判断依据
def is_regression(current_diff: DiffStat, history: list[DiffStat]) -> bool:
    """如果当前轮的文件改动量突然暴增（10x+）且删>增，大概率是误判"""
    if not history:
        return False
    avg_files = sum(h.files_changed for h in history) / len(history)
    return current_diff.files_changed > avg_files * 10 and current_diff.deletions > current_diff.insertions
```

---

## 五、各阶段工作分解

### 阶段 1（当前 → 下一轮迭代）

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 实现 `_check_process_stale` — kill 僵尸 | `supervisor.py` | 小 |
| 实现 `_check_failure_counter` — 熔断 | `supervisor.py` | 小 |
| 巡检间隔改为可配置 | `supervisor.py` + `config.yaml` | 中 |
| 告警→webhook（钉钉/飞书） | `supervisor.py` 新增 handler | 中 |
| 巡检测试覆盖 | `tests/` | 中 |

### 阶段 2（看门狗独立化）

| 任务 | 工作量 |
|------|--------|
| `supervisor.py` Qt 依赖解耦 | 中 |
| `oce-watchdog` CLI 入口 | 小 |
| `watchdog.yaml` 配置系统 | 小 |
| 巡检周期优化（600s→30s） | 小 |
| winsw 注册为 Windows 服务 | 小 |

### 阶段 3（Agent 恢复层）

| 任务 | 工作量 |
|------|--------|
| checkpoint 存储增强（prompt + 输出 + 文件变更） | 大 |
| 自动 resume 协议（与 OpenCode 协商） | 大 |
| diff 退化检测 + 自动回滚 | 中 |
| 跨 session 的误判传播阻断 | 大 |

---

## 六、边界与原则

### 6.1 不做的事

- ❌ 不做 OpenCode 的功能子集——不重新实现 agent 编排
- ❌ 不做全自动开发——`loop_engine.py` 的自动化始终是可选能力
- ❌ 不做跨平台——锁定 Windows（OpenCode + DSv4 的主力平台）
- ❌ 不做指标美化——监控面板优先展示精确数据，不做「看起来好用」的抽象

### 6.2 设计原则

1. **先能看，再能打** — 监控先行，干预在后
2. **看门狗永远有退出路径** — kill 是最后手段，优先 resume
3. **巡检不干扰被巡检对象** — 读 DB 只读不写，psutil 只扫不操（除非 act 阶段）
4. **告警必须有去处** — 不能只有 GUI 状态栏，必须有日志 + 外部通知

---

> 最后更新: 2026-05-26
> 修改: 初始版本 — 基于 Senior Dev 评估与 OCE 代码审查
