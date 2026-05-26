# Agent Workbench 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Rust + Tauri 重写 opencode-tui-enhance，构建一个 Agent 工作编排器：监控 OpenCode 进程、管理 git-worktree 隔离的 Agent 任务、提供人工 diff 审查闸门后合并的工作流。

**Architecture:** 
- 分层设计：Core（git/db/runner 纯函数）→ Engine（monitor/scheduler/review 状态机）→ API（Tauri commands 薄层）→ Frontend（React 页面）
- 唯一通信机制：Event 枚举 + mpsc::channel，层间零直接依赖
- 任务生命周期：用 Rust 枚举穷举状态转换，编译器保证无遗漏

**Tech Stack:** Rust 1.85+ + Tauri 2.x + React 18 + TypeScript + Vite + SQLite (rusqlite) + git2 (libgit2)

---

## Phase 0: 项目脚手架

### Task 0.1: 创建 Tauri 项目骨架

**Files:**
- Create: `tools/agent-workbench/src-tauri/Cargo.toml`
- Create: `tools/agent-workbench/src-tauri/tauri.conf.json`
- Create: `tools/agent-workbench/src-tauri/src/main.rs`
- Create: `tools/agent-workbench/src-tauri/src/lib.rs`
- Create: `tools/agent-workbench/src-tauri/build.rs`
- Create: `tools/agent-workbench/package.json`
- Create: `tools/agent-workbench/tsconfig.json`
- Create: `tools/agent-workbench/vite.config.ts`
- Create: `tools/agent-workbench/index.html`

- [ ] **Step 1: 创建 Cargo.toml**

```toml
[package]
name = "agent-workbench"
version = "0.1.0"
edition = "2021"
description = "OpenCode Agent 工作编排器 — 监控 + Git 分支隔离 + 人工审查合并"

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
git2 = "0.19"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
tokio = { version = "1", features = ["full"] }
sysinfo = "0.32"
thiserror = "2"
log = "0.4"
env_logger = "0.11"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

- [ ] **Step 2: 创建 tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "Agent Workbench",
  "version": "0.1.0",
  "identifier": "com.opencode.agent-workbench",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "title": "Agent Workbench",
    "windows": [
      {
        "title": "Agent Workbench - OpenCode 工作编排",
        "width": 1280,
        "height": 860,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "plugins": {
    "shell": {
      "open": true
    }
  }
}
```

- [ ] **Step 3: 创建 main.rs**

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    env_logger::init();
    agent_workbench::run();
}
```

- [ ] **Step 4: 创建 lib.rs**

```rust
mod commands;
mod core;
mod engine;
mod event;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log::info!("Agent Workbench 启动");
            // 初始化 engine 并注入 app state
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_processes,
            commands::get_tasks,
            commands::create_task,
            commands::approve_review,
            commands::reject_review,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: 创建 build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 6: 创建前端 package.json**

```json
{
  "name": "agent-workbench-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

- [ ] **Step 7: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 8: 创建 vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
```

- [ ] **Step 9: 创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Workbench</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: 创建占位前端入口**

```bash
mkdir -p tools/agent-workbench/src
```

创建 `tools/agent-workbench/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

创建 `tools/agent-workbench/src/App.tsx`:
```tsx
export default function App() {
  return <div>Agent Workbench</div>;
}
```

- [ ] **Step 11: 验证编译**

Run:
```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Compilation succeeds with no errors.

---

## Phase 1: Core 层 — Event 系统 + 数据模型

### Task 1.1: 定义 Event 枚举（系统"语言"）

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/event.rs`

- [ ] **Step 1: 创建 event.rs**

```rust
use serde::{Deserialize, Serialize};

/// 系统中唯一的事件类型 — 所有模块通过此枚举通信
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Event {
    // ── 进程监控 ──
    ProcessStarted {
        pid: u32,
        session_id: String,
        working_dir: String,
        model: String,
    },
    ProcessExited {
        pid: u32,
        exit_code: Option<i32>,
    },
    ProcessActivity {
        pid: u32,
        last_comm_secs_ago: f64,
    },

    // ── 任务调度 ──
    TaskCreated {
        task_id: String,
        prompt: String,
        branch_name: String,
    },
    TaskStarted {
        task_id: String,
        round: u32,
    },
    RoundCompleted {
        task_id: String,
        round: u32,
        files_changed: u32,
        insertions: u32,
        deletions: u32,
        diff_hash: String,
    },
    RoundFailed {
        task_id: String,
        round: u32,
        error: String,
    },
    TaskConverged {
        task_id: String,
        reason: String,
    },
    TaskFailed {
        task_id: String,
        reason: String,
    },

    // ── 审查流程 ──
    ReviewRequested {
        task_id: String,
        round: u32,
        diff_preview: String,
        diff_hash: String,
    },
    ReviewApproved {
        task_id: String,
    },
    ReviewRejected {
        task_id: String,
        reason: String,
    },
    MergeCompleted {
        task_id: String,
        commit_hash: String,
    },

    // ── 系统 ──
    Shutdown,
    Error {
        source: String,
        message: String,
    },
}
```

- [ ] **Step 2: 验证编译**

Run:
```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Pass.

---

### Task 1.2: 定义 Task 状态机

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/core/mod.rs`
- Create: `tools/agent-workbench/src-tauri/src/core/task.rs`

- [ ] **Step 1: 创建 core/mod.rs**

```rust
pub mod task;
pub mod git;
pub mod db;
pub mod runner;
```

- [ ] **Step 2: 创建 core/task.rs — 数据模型 + 状态机**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 任务状态枚举 — 编译器保证所有状态转换都被处理
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    /// 已创建，等待调度
    Created,
    /// 正在执行中（含当前轮次号）
    Running { round: u32 },
    /// 等待人工审查
    Reviewing {
        round: u32,
        diff_hash: String,
    },
    /// 正在合并到主分支
    Merging,
    /// 已完成
    Done,
    /// 失败（含原因）
    Failed { reason: String },
}

/// 单轮执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoundInfo {
    pub number: u32,
    pub files_changed: u32,
    pub insertions: u32,
    pub deletions: u32,
    pub diff_hash: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub reviewed: bool,
}

/// 任务完整状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub prompt: String,
    pub branch_name: String,
    pub worktree_path: String,
    pub status: TaskStatus,
    pub model: String,
    pub rounds: Vec<RoundInfo>,
    pub created_at: String,
    pub updated_at: String,
}

impl Task {
    pub fn new(id: String, prompt: String, branch_name: String, worktree_path: String, model: String) -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            id,
            prompt,
            branch_name,
            worktree_path,
            status: TaskStatus::Created,
            model,
            rounds: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    /// 状态转换 — 返回新状态，非法转换返回 Err
    pub fn transition(&self, event: &crate::event::Event) -> Result<TaskStatus, String> {
        use crate::event::Event;
        use TaskStatus::*;

        match (&self.status, event) {
            (Created, Event::TaskStarted { .. }) => Ok(Running { round: 1 }),
            (Running { round }, Event::RoundCompleted { diff_hash, diff_preview, .. }) => {
                Ok(Reviewing { round: *round, diff_hash: diff_hash.clone() })
            }
            (Running { .. }, Event::RoundFailed { .. }) => {
                Ok(Failed { reason: "execution error".into() })
            }
            (Running { .. }, Event::TaskConverged { .. }) => Ok(Done),
            (Reviewing { .. }, Event::ReviewApproved { .. }) => Ok(Merging),
            (Reviewing { round, .. }, Event::ReviewRejected { .. }) => {
                Ok(Running { round: *round })
            }
            (Merging, Event::MergeCompleted { .. }) => Ok(Done),
            _ => Err(format!(
                "非法状态转换: {:?} -> {:?}",
                self.status, event
            )),
        }
    }
}
```

- [ ] **Step 3: 添加单元测试**

在 `core/task.rs` 末尾添加:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::Event;

    fn make_task() -> Task {
        Task::new(
            "t1".into(),
            "test prompt".into(),
            "agent/task-t1".into(),
            "/tmp/t1".into(),
            "deepseek/deepseek-v4-pro".into(),
        )
    }

    #[test]
    fn test_created_to_running() {
        let t = make_task();
        let next = t.transition(&Event::TaskStarted {
            task_id: "t1".into(),
            round: 1,
        });
        assert_eq!(next.unwrap(), TaskStatus::Running { round: 1 });
    }

    #[test]
    fn test_running_to_reviewing() {
        let mut t = make_task();
        t.status = TaskStatus::Running { round: 2 };
        let next = t.transition(&Event::RoundCompleted {
            task_id: "t1".into(),
            round: 2,
            files_changed: 3,
            insertions: 10,
            deletions: 2,
            diff_hash: "abc123".into(),
            diff_preview: "diff --git ...".into(),
        });
        assert_eq!(next.unwrap(), TaskStatus::Reviewing { round: 2, diff_hash: "abc123".into() });
    }

    #[test]
    fn test_review_approved_to_merging() {
        let mut t = make_task();
        t.status = TaskStatus::Reviewing { round: 1, diff_hash: "abc".into() };
        let next = t.transition(&Event::ReviewApproved { task_id: "t1".into() });
        assert_eq!(next.unwrap(), TaskStatus::Merging);
    }

    #[test]
    fn test_review_rejected_back_to_running() {
        let mut t = make_task();
        t.status = TaskStatus::Reviewing { round: 3, diff_hash: "abc".into() };
        let next = t.transition(&Event::ReviewRejected {
            task_id: "t1".into(),
            reason: "改动不完整".into(),
        });
        assert_eq!(next.unwrap(), TaskStatus::Running { round: 3 });
    }

    #[test]
    fn test_illegal_transition_returns_err() {
        let t = make_task(); // Created
        let result = t.transition(&Event::ReviewApproved { task_id: "t1".into() });
        assert!(result.is_err());
    }
}
```

- [ ] **Step 4: 运行测试**

```bash
cd tools/agent-workbench && cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: 5 tests pass.

---

## Phase 2: Core 层 — Git 操作

### Task 2.1: Git Worktree 管理

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/core/git.rs`

- [ ] **Step 1: 创建 core/git.rs**

```rust
use git2::{Repository, BranchType};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct WorktreeInfo {
    pub path: PathBuf,
    pub branch_name: String,
}

pub struct GitOps {
    repo_path: PathBuf,
    worktrees_dir: PathBuf,
}

impl GitOps {
    pub fn new(repo_path: impl Into<PathBuf>) -> Self {
        let repo_path = repo_path.into();
        let worktrees_dir = repo_path.join(".worktrees");
        Self { repo_path, worktrees_dir }
    }

    /// 基于 master 分支创建 worktree
    pub fn create_worktree(&self, task_id: &str) -> Result<WorktreeInfo, String> {
        let repo = Repository::open(&self.repo_path)
            .map_err(|e| format!("打开仓库失败: {}", e))?;

        let branch_name = format!("agent/task-{}", task_id);
        let wt_path = self.worktrees_dir.join(task_id);

        // 确保 worktrees 根目录存在
        std::fs::create_dir_all(&self.worktrees_dir)
            .map_err(|e| format!("创建 worktrees 目录失败: {}", e))?;

        // 找到 master 分支的 commit
        let master = repo.find_branch("master", BranchType::Local)
            .map_err(|_| "找不到 master 分支".to_string())?;
        let master_commit = master.get().peel_to_commit()
            .map_err(|e| format!("解析 master commit 失败: {}", e))?;

        // 创建新分支（不切换）
        repo.branch(&branch_name, &master_commit, false)
            .map_err(|e| format!("创建分支失败: {}", e))?;

        // 创建 worktree
        repo.worktree(&branch_name, &wt_path, None)
            .map_err(|e| format!("创建 worktree 失败: {}", e))?;

        Ok(WorktreeInfo {
            path: wt_path,
            branch_name,
        })
    }

    /// 从 worktree 路径获取 git diff
    pub fn get_diff(&self, worktree_path: &Path) -> Result<String, String> {
        let repo = Repository::open(worktree_path)
            .map_err(|e| format!("打开 worktree 仓库失败: {}", e))?;

        let head = repo.head()
            .map_err(|e| format!("获取 HEAD 失败: {}", e))?;
        let head_tree = head.peel_to_tree()
            .map_err(|e| format!("解析 HEAD tree 失败: {}", e))?;

        let diff = repo.diff_tree_to_workdir(Some(&head_tree), None)
            .map_err(|e| format!("生成 diff 失败: {}", e))?;

        let mut diff_text = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = match line.origin() {
                '+' => "+",
                '-' => "-",
                ' ' => " ",
                _ => "",
            };
            let content = String::from_utf8_lossy(line.content());
            diff_text.push_str(&format!("{}{}", origin, content));
            true
        }).map_err(|e| format!("格式化 diff 失败: {}", e))?;

        Ok(diff_text)
    }

    /// 解析 diff 统计（文件数、增删行数）
    pub fn parse_diff_stat(diff: &str) -> DiffStat {
        let mut stat = DiffStat::default();
        for line in diff.lines() {
            if line.starts_with("diff --git") {
                stat.files_changed += 1;
            } else if line.starts_with('+') && !line.starts_with("+++") {
                stat.insertions += 1;
            } else if line.starts_with('-') && !line.starts_with("---") {
                stat.deletions += 1;
            }
        }
        stat
    }

    /// 合并 worktree 分支到 master
    pub fn merge_to_master(&self, task_id: &str, branch_name: &str) -> Result<String, String> {
        let repo = Repository::open(&self.repo_path)
            .map_err(|e| format!("打开仓库失败: {}", e))?;

        // 找到要合并的分支
        let branch = repo.find_branch(branch_name, BranchType::Local)
            .map_err(|e| format!("找不到分支 {}: {}", branch_name, e))?;
        let branch_commit = branch.get().peel_to_commit()
            .map_err(|e| format!("解析分支 commit 失败: {}", e))?;

        // 获取 master 的引用
        let master_ref = repo.find_reference("refs/heads/master")
            .map_err(|_| "找不到 refs/heads/master".to_string())?;
        let master_commit = master_ref.peel_to_commit()
            .map_err(|e| format!("解析 master commit 失败: {}", e))?;

        // 执行 merge（fast-forward 优先）
        let mut merge_opts = git2::MergeOptions::new();
        merge_opts.fail_on_conflict(true);

        // 实际合并：将分支 commit merge 到 master
        let mut annotated = repo.find_annotated_commit(branch_commit.id())
            .map_err(|e| format!("annotate commit 失败: {}", e))?;

        repo.merge(&[&annotated], None, None)
            .map_err(|e| format!("merge 失败: {}", e))?;

        // 检查有无冲突
        if repo.index().map_err(|e| format!("获取 index 失败: {}", e))?.has_conflicts() {
            // 回滚 merge
            repo.cleanup_state().ok();
            return Err("merge 有冲突，已回滚".into());
        }

        // 创建 merge commit
        let sig = repo.signature()
            .map_err(|e| format!("获取签名失败: {}", e))?;
        let tree_id = {
            let mut index = repo.index().map_err(|e| format!("获取 index 失败: {}", e))?;
            index.write_tree().map_err(|e| format!("写 tree 失败: {}", e))?
        };
        let tree = repo.find_tree(tree_id).map_err(|e| format!("找 tree 失败: {}", e))?;

        let msg = format!("[agent-workbench] 合并任务 {} ({})", task_id, branch_name);
        let commit_id = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &msg,
            &tree,
            &[&master_commit, &branch_commit],
        ).map_err(|e| format!("创建 merge commit 失败: {}", e))?;

        // 清理 worktree
        self.remove_worktree(task_id)?;

        Ok(commit_id.to_string())
    }

    /// 移除 worktree
    pub fn remove_worktree(&self, task_id: &str) -> Result<(), String> {
        let wt_path = self.worktrees_dir.join(task_id);
        if wt_path.exists() {
            // 先删除 worktree 目录（git2 不支持直接删除 worktree，用 std::fs）
            std::fs::remove_dir_all(&wt_path)
                .map_err(|e| format!("删除 worktree 目录失败: {}", e))?;
        }
        // Prune git worktree 引用
        let repo = Repository::open(&self.repo_path)
            .map_err(|e| format!("打开仓库失败: {}", e))?;
        repo.cleanup_state().ok(); // 清理可能的 merge 状态
        Ok(())
    }

    /// 检查 diff 是否收敛（改动量比上一轮减少 70% 以上）
    pub fn is_converging(prev: &DiffStat, curr: &DiffStat) -> bool {
        let prev_total = prev.insertions + prev.deletions;
        let curr_total = curr.insertions + curr.deletions;
        if prev_total == 0 {
            return false;
        }
        (curr_total as f64 / prev_total as f64) < 0.3
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiffStat {
    pub files_changed: u32,
    pub insertions: u32,
    pub deletions: u32,
}
```

需要添加 serde 导入，在文件顶部加上:
```rust
use serde::{Deserialize, Serialize};
```

- [ ] **Step 2: 添加单元测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_diff_stat_parsing() {
        let diff = "diff --git a/foo.txt b/foo.txt\n+hello\n+world\n-old\n";
        let stat = GitOps::parse_diff_stat(diff);
        assert_eq!(stat.files_changed, 1);
        assert_eq!(stat.insertions, 2);
        assert_eq!(stat.deletions, 1);
    }

    #[test]
    fn test_is_converging_true() {
        let prev = DiffStat { files_changed: 5, insertions: 100, deletions: 50 };
        let curr = DiffStat { files_changed: 2, insertions: 10, deletions: 5 };
        assert!(GitOps::is_converging(&prev, &curr));
    }

    #[test]
    fn test_is_converging_false() {
        let prev = DiffStat { files_changed: 5, insertions: 100, deletions: 50 };
        let curr = DiffStat { files_changed: 5, insertions: 80, deletions: 40 };
        assert!(!GitOps::is_converging(&prev, &curr));
    }
}
```

- [ ] **Step 3: 运行测试**

```bash
cd tools/agent-workbench && cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: 8 tests pass (5 from task + 3 from git).

---

## Phase 3: Core 层 — SQLite 持久化

### Task 3.1: 数据库 Schema + CRUD

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/core/db.rs`

- [ ] **Step 1: 创建 core/db.rs**

```rust
use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

use super::task::{Task, TaskStatus, RoundInfo};

pub struct DbStore {
    conn: Mutex<Connection>,
}

impl DbStore {
    pub fn new(path: impl Into<PathBuf>) -> Result<Self, String> {
        let conn = Connection::open(path.into())
            .map_err(|e| format!("打开数据库失败: {}", e))?;

        let store = Self { conn: Mutex::new(conn) };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                branch_name TEXT NOT NULL,
                worktree_path TEXT NOT NULL,
                status TEXT NOT NULL,
                status_data TEXT,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                number INTEGER NOT NULL,
                files_changed INTEGER NOT NULL DEFAULT 0,
                insertions INTEGER NOT NULL DEFAULT 0,
                deletions INTEGER NOT NULL DEFAULT 0,
                diff_hash TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                reviewed INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_rounds_task_id ON rounds(task_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        ").map_err(|e| format!("执行 migration 失败: {}", e))?;
        Ok(())
    }

    /// 保存任务（upsert）
    pub fn save_task(&self, task: &Task) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        let status_str = serde_json::to_string(&task.status)
            .map_err(|e| format!("序列化状态失败: {}", e))?;

        conn.execute(
            "INSERT INTO tasks (id, prompt, branch_name, worktree_path, status, status_data, model, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                status_data = excluded.status_data,
                updated_at = excluded.updated_at",
            params![
                task.id,
                task.prompt,
                task.branch_name,
                task.worktree_path,
                status_label(&task.status),
                status_str,
                task.model,
                task.created_at,
                task.updated_at,
            ],
        ).map_err(|e| format!("保存任务失败: {}", e))?;

        // 保存轮次
        for round in &task.rounds {
            conn.execute(
                "INSERT OR REPLACE INTO rounds (task_id, number, files_changed, insertions, deletions, diff_hash, started_at, completed_at, reviewed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    task.id,
                    round.number,
                    round.files_changed,
                    round.insertions,
                    round.deletions,
                    round.diff_hash,
                    round.started_at,
                    round.completed_at,
                    round.reviewed as i32,
                ],
            ).map_err(|e| format!("保存轮次失败: {}", e))?;
        }
        Ok(())
    }

    /// 加载单个任务
    pub fn load_task(&self, task_id: &str) -> Result<Option<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, prompt, branch_name, worktree_path, status_data, model, created_at, updated_at
             FROM tasks WHERE id = ?1"
        ).map_err(|e| format!("准备查询失败: {}", e))?;

        let task_opt = stmt.query_row(params![task_id], |row| {
            let status_data: String = row.get(4)?;
            Ok(Task {
                id: row.get(0)?,
                prompt: row.get(1)?,
                branch_name: row.get(2)?,
                worktree_path: row.get(3)?,
                status: serde_json::from_str(&status_data).unwrap_or(TaskStatus::Failed {
                    reason: "corrupted status".into(),
                }),
                model: row.get(5)?,
                rounds: Vec::new(),
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).ok();

        if let Some(mut task) = task_opt {
            // 加载轮次
            let mut round_stmt = conn.prepare(
                "SELECT number, files_changed, insertions, deletions, diff_hash, started_at, completed_at, reviewed
                 FROM rounds WHERE task_id = ?1 ORDER BY number ASC"
            ).map_err(|e| format!("准备轮次查询失败: {}", e))?;

            let rounds = round_stmt.query_map(params![task_id], |row| {
                Ok(RoundInfo {
                    number: row.get(0)?,
                    files_changed: row.get(1)?,
                    insertions: row.get(2)?,
                    deletions: row.get(3)?,
                    diff_hash: row.get(4)?,
                    started_at: row.get(5)?,
                    completed_at: row.get(6)?,
                    reviewed: row.get::<_, i32>(7)? != 0,
                })
            }).map_err(|e| format!("查询轮次失败: {}", e))?;

            for round in rounds {
                task.rounds.push(round.map_err(|e| format!("读取轮次失败: {}", e))?);
            }
            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    /// 列出所有任务
    pub fn list_tasks(&self, status_filter: Option<&str>) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        let query = if let Some(status) = status_filter {
            format!(
                "SELECT id FROM tasks WHERE status = '{}' ORDER BY created_at DESC",
                status
            )
        } else {
            "SELECT id FROM tasks ORDER BY created_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&query)
            .map_err(|e| format!("准备查询失败: {}", e))?;
        let ids: Vec<String> = stmt.query_map([], |row| row.get(0))
            .map_err(|e| format!("查询失败: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        // 逐条加载完整信息
        let mut tasks = Vec::new();
        for id in &ids {
            if let Some(task) = self.load_task(id)? {
                tasks.push(task);
            }
        }
        Ok(tasks)
    }

    /// 删除任务（级联删除轮次）
    pub fn delete_task(&self, task_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])
            .map_err(|e| format!("删除任务失败: {}", e))?;
        Ok(())
    }
}

fn status_label(status: &TaskStatus) -> &'static str {
    match status {
        TaskStatus::Created => "created",
        TaskStatus::Running { .. } => "running",
        TaskStatus::Reviewing { .. } => "reviewing",
        TaskStatus::Merging => "merging",
        TaskStatus::Done => "done",
        TaskStatus::Failed { .. } => "failed",
    }
}
```

- [ ] **Step 2: 添加测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_save_and_load_task() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let store = DbStore::new(db_path).unwrap();

        let task = Task::new(
            "test-1".into(),
            "修复所有类型错误".into(),
            "agent/task-test-1".into(),
            "/tmp/test-1".into(),
            "deepseek/deepseek-v4-pro".into(),
        );

        store.save_task(&task).unwrap();
        let loaded = store.load_task("test-1").unwrap().unwrap();
        assert_eq!(loaded.id, "test-1");
        assert_eq!(loaded.prompt, "修复所有类型错误");
        assert_eq!(loaded.status, TaskStatus::Created);
    }
}
```

在 Cargo.toml 添加 dev-dependency:
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 3: 运行测试**

```bash
cd tools/agent-workbench && cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: 9 tests pass.

---

## Phase 4: Core 层 — Agent 执行器

### Task 4.1: opencode CLI 子进程调用

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/core/runner.rs`

- [ ] **Step 1: 创建 core/runner.rs**

```rust
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::io::Write;

pub struct AgentRunner {
    opencode_bin: PathBuf,
    default_model: String,
    timeout_seconds: u64,
}

#[derive(Debug)]
pub struct RunResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub output: String,
    pub error: String,
    pub duration_secs: f64,
}

impl AgentRunner {
    pub fn new(opencode_bin: impl Into<PathBuf>, default_model: String) -> Self {
        Self {
            opencode_bin: opencode_bin.into(),
            default_model,
            timeout_seconds: 1800, // 30 分钟默认
        }
    }

    /// 同步执行一次 opencode run（在 worktree 目录下）
    pub fn run(
        &self,
        worktree_path: &std::path::Path,
        prompt: &str,
        model: Option<&str>,
    ) -> RunResult {
        let model = model.unwrap_or(&self.default_model);
        let start = std::time::Instant::now();

        // 构建命令: opencode --model <model> run
        let mut child = match Command::new(&self.opencode_bin)
            .args(["--model", model, "run"])
            .current_dir(worktree_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                return RunResult {
                    success: false,
                    exit_code: None,
                    output: String::new(),
                    error: format!("启动 opencode 失败: {}", e),
                    duration_secs: start.elapsed().as_secs_f64(),
                };
            }
        };

        // 写入 prompt
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(prompt.as_bytes());
            // stdin 在 drop 时自动关闭
        }

        // 等待完成（带超时）
        let result = match std::time::Duration::from_secs(self.timeout_seconds) {
            timeout => {
                // 简单轮询等待
                let wait_start = std::time::Instant::now();
                loop {
                    match child.try_wait() {
                        Ok(Some(status)) => break Ok(status),
                        Ok(None) => {
                            if wait_start.elapsed() > std::time::Duration::from_secs(self.timeout_seconds) {
                                let _ = child.kill();
                                break Err("超时".to_string());
                            }
                            std::thread::sleep(std::time::Duration::from_millis(500));
                        }
                        Err(e) => break Err(format!("等待子进程失败: {}", e)),
                    }
                }
            }
        };

        let output = match child.wait_with_output() {
            Ok(o) => o,
            Err(e) => {
                return RunResult {
                    success: false,
                    exit_code: None,
                    output: String::new(),
                    error: format!("读取输出失败: {}", e),
                    duration_secs: start.elapsed().as_secs_f64(),
                };
            }
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        RunResult {
            success: output.status.success(),
            exit_code: output.status.code(),
            output: stdout,
            error: stderr,
            duration_secs: start.elapsed().as_secs_f64(),
        }
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Pass.

---

## Phase 5: Engine 层 — 进程监控

### Task 5.1: 进程扫描 + Session 关联

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/engine/mod.rs`
- Create: `tools/agent-workbench/src-tauri/src/engine/monitor.rs`

- [ ] **Step 1: 创建 engine/mod.rs**

```rust
pub mod monitor;
pub mod scheduler;
pub mod review;
```

- [ ] **Step 2: 创建 engine/monitor.rs**

```rust
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use crate::event::Event;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cmdline: String,
    pub cpu_percent: f32,
    pub memory_mb: f64,
    pub running_secs: u64,
    pub session_id: Option<String>,
    pub model: Option<String>,
}

pub struct ProcessMonitor {
    tx: mpsc::Sender<Event>,
}

impl ProcessMonitor {
    pub fn new(tx: mpsc::Sender<Event>) -> Self {
        Self { tx }
    }

    /// 启动后台扫描线程
    pub fn start(self) -> thread::JoinHandle<()> {
        thread::spawn(move || {
            let mut sys = System::new();
            let mut known_pids: std::collections::HashSet<u32> = std::collections::HashSet::new();

            loop {
                sys.refresh_processes_specifics(
                    ProcessesToUpdate::All,
                    true,
                    ProcessRefreshKind::everything(),
                );

                let current_pids: std::collections::HashSet<u32> = sys
                    .processes()
                    .iter()
                    .filter(|(_, p)| {
                        let name = p.name().to_lowercase();
                        name.contains("opencode") || name == "node" || name == "node.exe"
                    })
                    .map(|(pid, _)| pid.as_u32())
                    .collect();

                // 检测新进程
                for pid in &current_pids {
                    if !known_pids.contains(pid) {
                        if let Some(proc) = sys.process(Pid::from_u32(*pid)) {
                            let name = proc.name().to_string();
                            // 对于 node 进程，检查 cmdline 是否含 opencode
                            if name.contains("node") {
                                let cmdline: Vec<String> = proc.cmd().to_vec();
                                let cmdline_str = cmdline.join(" ");
                                if !cmdline_str.contains("opencode") {
                                    continue;
                                }
                            }
                            let _ = self.tx.send(Event::ProcessStarted {
                                pid: *pid,
                                session_id: String::new(), // 后续从 DB 关联
                                working_dir: proc.cwd().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
                                model: String::new(),
                            });
                        }
                    }
                }

                // 检测退出进程
                for pid in &known_pids {
                    if !current_pids.contains(pid) {
                        let _ = self.tx.send(Event::ProcessExited {
                            pid: *pid,
                            exit_code: None,
                        });
                    }
                }

                known_pids = current_pids;
                thread::sleep(Duration::from_secs(5));
            }
        })
    }

    /// 单次扫描（用于同步查询）
    pub fn scan_once() -> Vec<ProcessInfo> {
        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::everything(),
        );

        sys.processes()
            .iter()
            .filter(|(_, p)| {
                let name = p.name().to_lowercase();
                name.contains("opencode") || {
                    if name.contains("node") {
                        p.cmd().join(" ").contains("opencode")
                    } else {
                        false
                    }
                }
            })
            .map(|(pid, proc)| ProcessInfo {
                pid: pid.as_u32(),
                name: proc.name().to_string(),
                cmdline: proc.cmd().join(" "),
                cpu_percent: proc.cpu_usage(),
                memory_mb: proc.memory() as f64 / (1024.0 * 1024.0),
                running_secs: proc.run_time(),
                session_id: None,
                model: None,
            })
            .collect()
    }
}
```

- [ ] **Step 3: 编译验证**

```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Pass.

---

## Phase 6: Engine 层 — 任务调度器

### Task 6.1: 调度器 + 事件循环

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/engine/scheduler.rs`

- [ ] **Step 1: 创建 engine/scheduler.rs**

```rust
use std::sync::mpsc::{self, Sender, Receiver};
use std::thread;
use std::collections::HashMap;
use crate::core::task::{Task, TaskStatus};
use crate::core::git::GitOps;
use crate::core::db::DbStore;
use crate::core::runner::AgentRunner;
use crate::event::Event;

pub struct Scheduler {
    git: GitOps,
    db: DbStore,
    runner: AgentRunner,
    tasks: HashMap<String, Task>,
    event_tx: Sender<Event>,
    event_rx: Receiver<Event>,
}

impl Scheduler {
    pub fn new(
        repo_path: String,
        db_path: String,
        opencode_bin: String,
        default_model: String,
    ) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();
        Ok(Self {
            git: GitOps::new(repo_path),
            db: DbStore::new(db_path)?,
            runner: AgentRunner::new(opencode_bin, default_model),
            tasks: HashMap::new(),
            event_tx: tx,
            event_rx: rx,
        })
    }

    /// 获取事件发送端（供外部模块注入事件）
    pub fn get_sender(&self) -> Sender<Event> {
        self.event_tx.clone()
    }

    /// 启动调度事件循环（在独立线程中运行）
    pub fn start(mut self) -> thread::JoinHandle<()> {
        thread::spawn(move || {
            log::info!("调度器事件循环启动");
            // 恢复之前未完成的任务
            self.recover_tasks();

            loop {
                match self.event_rx.recv() {
                    Ok(event) => {
                        log::debug!("收到事件: {:?}", event);
                        if let Err(e) = self.handle_event(event) {
                            log::error!("处理事件失败: {}", e);
                        }
                    }
                    Err(_) => {
                        log::info!("事件通道关闭，调度器退出");
                        break;
                    }
                }
            }
        })
    }

    fn handle_event(&mut self, event: Event) -> Result<(), String> {
        match &event {
            Event::TaskCreated { task_id, prompt, branch_name } => {
                // 创建 worktree
                let wt = self.git.create_worktree(task_id)?;
                let mut task = Task::new(
                    task_id.clone(),
                    prompt.clone(),
                    branch_name.clone(),
                    wt.path.to_string_lossy().to_string(),
                    self.runner.default_model.clone(),
                );
                self.db.save_task(&task)?;
                self.tasks.insert(task_id.clone(), task);

                // 自动开始执行
                let _ = self.event_tx.send(Event::TaskStarted {
                    task_id: task_id.clone(),
                    round: 1,
                });
            }

            Event::TaskStarted { task_id, round } => {
                if let Some(task) = self.tasks.get_mut(task_id) {
                    task.status = TaskStatus::Running { round: *round };
                    task.updated_at = chrono::Utc::now().to_rfc3339();
                    self.db.save_task(task)?;

                    // 执行 Agent
                    let result = self.runner.run(
                        &std::path::PathBuf::from(&task.worktree_path),
                        &task.prompt,
                        Some(&task.model),
                    );

                    if result.success {
                        let diff = self.git.get_diff(
                            &std::path::PathBuf::from(&task.worktree_path),
                        )?;
                        let stat = GitOps::parse_diff_stat(&diff);

                        let _ = self.event_tx.send(Event::RoundCompleted {
                            task_id: task_id.clone(),
                            round: *round,
                            files_changed: stat.files_changed,
                            insertions: stat.insertions,
                            deletions: stat.deletions,
                            diff_hash: sha256_hash(&diff),
                            diff_preview: truncate_diff(&diff, 500),
                        });
                    } else {
                        let _ = self.event_tx.send(Event::RoundFailed {
                            task_id: task_id.clone(),
                            round: *round,
                            error: result.error,
                        });
                    }
                }
            }

            Event::RoundCompleted { task_id, round, diff_hash, .. } => {
                if let Some(task) = self.tasks.get_mut(task_id) {
                    task.status = TaskStatus::Reviewing {
                        round: *round,
                        diff_hash: diff_hash.clone(),
                    };
                    let diff = self.git.get_diff(
                        &std::path::PathBuf::from(&task.worktree_path),
                    ).unwrap_or_default();

                    let _ = self.event_tx.send(Event::ReviewRequested {
                        task_id: task_id.clone(),
                        round: *round,
                        diff_preview: truncate_diff(&diff, 500),
                        diff_hash: diff_hash.clone(),
                    });
                }
            }

            Event::ReviewApproved { task_id } => {
                if let Some(task) = self.tasks.get(task_id) {
                    let commit = self.git.merge_to_master(
                        task_id,
                        &task.branch_name,
                    )?;
                    let _ = self.event_tx.send(Event::MergeCompleted {
                        task_id: task_id.clone(),
                        commit_hash: commit,
                    });
                }
            }

            Event::ReviewRejected { task_id, .. } => {
                if let Some(task) = self.tasks.get_mut(task_id) {
                    task.status = TaskStatus::Running {
                        round: task.rounds.last().map(|r| r.number).unwrap_or(1),
                    };
                    self.db.save_task(task)?;
                }
            }

            _ => {}
        }
        Ok(())
    }

    fn recover_tasks(&mut self) {
        if let Ok(tasks) = self.db.list_tasks(Some("running")) {
            for task in tasks {
                log::info!("恢复任务: {} (status={:?})", task.id, task.status);
                self.tasks.insert(task.id.clone(), task);
            }
        }
    }
}

fn sha256_hash(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    format!("{:x}", h.finish())
}

fn truncate_diff(diff: &str, max_len: usize) -> String {
    if diff.len() <= max_len {
        diff.to_string()
    } else {
        format!("{}... (共 {} 字符)", &diff[..max_len], diff.len())
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Pass.

---

## Phase 7: Engine 层 — 审查闸门

### Task 7.1: 审查状态管理

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/engine/review.rs`

- [ ] **Step 1: 创建 engine/review.rs**

```rust
use std::collections::HashMap;
use crate::event::Event;
use std::sync::mpsc::Sender;

/// 待审查队列管理
pub struct ReviewGate {
    /// task_id -> (round, diff_preview, diff_hash)
    pending: HashMap<String, (u32, String, String)>,
    event_tx: Sender<Event>,
}

impl ReviewGate {
    pub fn new(event_tx: Sender<Event>) -> Self {
        Self {
            pending: HashMap::new(),
            event_tx,
        }
    }

    /// 添加到审查队列
    pub fn enqueue(&mut self, task_id: String, round: u32, diff_preview: String, diff_hash: String) {
        self.pending.insert(task_id.clone(), (round, diff_preview, diff_hash));
        log::info!("审查队列: {} 项待审查", self.pending.len());
    }

    /// 批准审查
    pub fn approve(&mut self, task_id: &str) -> Result<(), String> {
        if self.pending.remove(task_id).is_some() {
            self.event_tx.send(Event::ReviewApproved {
                task_id: task_id.to_string(),
            }).map_err(|e| format!("发送批准事件失败: {}", e))?;
            Ok(())
        } else {
            Err(format!("任务 {} 不在审查队列中", task_id))
        }
    }

    /// 拒绝审查
    pub fn reject(&mut self, task_id: &str, reason: String) -> Result<(), String> {
        if self.pending.remove(task_id).is_some() {
            self.event_tx.send(Event::ReviewRejected {
                task_id: task_id.to_string(),
                reason,
            }).map_err(|e| format!("发送拒绝事件失败: {}", e))?;
            Ok(())
        } else {
            Err(format!("任务 {} 不在审查队列中", task_id))
        }
    }

    /// 获取待审查任务列表
    pub fn list_pending(&self) -> Vec<(String, u32, String, String)> {
        self.pending
            .iter()
            .map(|(id, (round, preview, hash))| (id.clone(), *round, preview.clone(), hash.clone()))
            .collect()
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Pass.

---

## Phase 8: API 层 — Tauri Commands

### Task 8.1: 前端 IPC 接口

**Files:**
- Create: `tools/agent-workbench/src-tauri/src/commands.rs`

- [ ] **Step 1: 创建 commands.rs**

```rust
use tauri::State;
use std::sync::Mutex;
use crate::engine::monitor::ProcessMonitor;
use crate::engine::scheduler::Scheduler;
use crate::engine::review::ReviewGate;
use crate::core::db::DbStore;

/// 全局应用状态
pub struct AppState {
    pub scheduler_tx: std::sync::mpsc::Sender<crate::event::Event>,
    pub db: DbStore,
    pub review_gate: Mutex<ReviewGate>,
}

// ── 进程相关 ──

#[tauri::command]
pub fn get_processes() -> Result<Vec<crate::engine::monitor::ProcessInfo>, String> {
    Ok(ProcessMonitor::scan_once())
}

// ── 任务相关 ──

#[tauri::command]
pub fn get_tasks(state: State<'_, AppState>) -> Result<Vec<crate::core::task::Task>, String> {
    state.db.list_tasks(None)
}

#[tauri::command]
pub fn create_task(
    state: State<'_, AppState>,
    prompt: String,
    model: Option<String>,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
    let branch_name = format!("agent/task-{}", task_id);

    let _ = state.scheduler_tx.send(crate::event::Event::TaskCreated {
        task_id: task_id.clone(),
        prompt,
        branch_name,
    });

    Ok(task_id)
}

// ── 审查相关 ──

#[tauri::command]
pub fn approve_review(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.review_gate.lock()
        .map_err(|e| format!("获取锁失败: {}", e))?
        .approve(&task_id)
}

#[tauri::command]
pub fn reject_review(state: State<'_, AppState>, task_id: String, reason: String) -> Result<(), String> {
    state.review_gate.lock()
        .map_err(|e| format!("获取锁失败: {}", e))?
        .reject(&task_id, reason)
}

#[tauri::command]
pub fn get_pending_reviews(state: State<'_, AppState>) -> Result<Vec<(String, u32, String, String)>, String> {
    Ok(state.review_gate.lock()
        .map_err(|e| format!("获取锁失败: {}", e))?
        .list_pending())
}
```

- [ ] **Step 2: 更新 lib.rs 集成 AppState**

修改 `tools/agent-workbench/src-tauri/src/lib.rs`:

```rust
mod commands;
mod core;
mod engine;
mod event;

use commands::AppState;
use engine::monitor::ProcessMonitor;
use engine::scheduler::Scheduler;
use engine::review::ReviewGate;
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log::info!("Agent Workbench 启动");

            // 从环境/配置获取路径
            let repo_path = std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".into());
            let db_path = format!("{}/state/agent_workbench.db", repo_path);

            // 初始化调度器
            let scheduler = Scheduler::new(
                repo_path,
                db_path,
                "opencode".into(),
                "deepseek/deepseek-v4-pro".into(),
            ).expect("初始化调度器失败");

            let scheduler_tx = scheduler.get_sender();
            let db = crate::core::db::DbStore::new(
                format!("{}/state/agent_workbench.db",
                    std::env::current_dir().unwrap().to_string_lossy())
            ).expect("初始化 DB 失败");

            let review_gate = Mutex::new(ReviewGate::new(scheduler_tx.clone()));

            // 注入全局状态
            app.manage(AppState {
                scheduler_tx: scheduler_tx.clone(),
                db,
                review_gate,
            });

            // 启动后台线程
            let monitor = ProcessMonitor::new(scheduler_tx.clone());
            monitor.start();

            scheduler.start();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_processes,
            commands::get_tasks,
            commands::create_task,
            commands::approve_review,
            commands::reject_review,
            commands::get_pending_reviews,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: 编译验证**

```bash
cd tools/agent-workbench && cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: Pass.

---

## Phase 9: 前端 — Dashboard 页面（进程监控）

### Task 9.1: Dashboard 页面

**Files:**
- Create: `tools/agent-workbench/src/pages/Dashboard.tsx`
- Create: `tools/agent-workbench/src/components/ProcessCard.tsx`
- Create: `tools/agent-workbench/src/types.ts`
- Modify: `tools/agent-workbench/src/App.tsx`

- [ ] **Step 1: 创建类型定义 types.ts**

```typescript
// 前端类型定义 — 与 Rust 的 ProcessInfo / Task 对应
export interface ProcessInfo {
  pid: number;
  name: string;
  cmdline: string;
  cpu_percent: number;
  memory_mb: number;
  running_secs: number;
  session_id: string | null;
  model: string | null;
}

export interface RoundInfo {
  number: number;
  files_changed: number;
  insertions: number;
  deletions: number;
  diff_hash: string;
  started_at: string;
  completed_at: string | null;
  reviewed: boolean;
}

export type TaskStatus =
  | "created"
  | { running: { round: number } }
  | { reviewing: { round: number; diff_hash: string } }
  | "merging"
  | "done"
  | { failed: { reason: string } };

export interface Task {
  id: string;
  prompt: string;
  branch_name: string;
  worktree_path: string;
  status: string; // JSON string of TaskStatus
  model: string;
  rounds: RoundInfo[];
  created_at: string;
  updated_at: string;
}

export interface PendingReview {
  task_id: string;
  round: number;
  diff_preview: string;
  diff_hash: string;
}
```

- [ ] **Step 2: 创建 ProcessCard 组件**

```tsx
// tools/agent-workbench/src/components/ProcessCard.tsx
import type { ProcessInfo } from "../types";

interface Props {
  process: ProcessInfo;
}

export default function ProcessCard({ process }: Props) {
  const memMb = process.memory_mb.toFixed(1);
  const cpu = process.cpu_percent.toFixed(1);
  const uptimeMin = Math.floor(process.running_secs / 60);

  return (
    <div className="process-card">
      <div className="process-header">
        <span className={`status-dot ${process.session_id ? "active" : "unknown"}`} />
        <strong>PID {process.pid}</strong>
        <span className="process-name">{process.name}</span>
      </div>
      <div className="process-meta">
        <span>CPU: {cpu}%</span>
        <span>内存: {memMb} MB</span>
        <span>运行: {uptimeMin}分钟</span>
      </div>
      {process.model && (
        <div className="process-model">模型: {process.model}</div>
      )}
      {process.session_id && (
        <div className="process-session">会话: {process.session_id.slice(0, 16)}...</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 Dashboard 页面**

```tsx
// tools/agent-workbench/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProcessInfo } from "../types";
import ProcessCard from "../components/ProcessCard";

export default function Dashboard() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始加载
    invoke<ProcessInfo[]>("get_processes")
      .then(setProcesses)
      .catch(console.error)
      .finally(() => setLoading(false));

    // 每 5 秒轮询
    const timer = setInterval(() => {
      invoke<ProcessInfo[]>("get_processes")
        .then(setProcesses)
        .catch(console.error);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="page dashboard">
      <h1>进程监控</h1>
      {loading ? (
        <p>加载中...</p>
      ) : processes.length === 0 ? (
        <p className="empty">没有运行中的 OpenCode 进程</p>
      ) : (
        <div className="process-grid">
          {processes.map((p) => (
            <ProcessCard key={p.pid} process={p} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 修改 App.tsx 添加路由**

```tsx
// tools/agent-workbench/src/App.tsx
import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Review from "./pages/Review";
import "./App.css";

type Page = "dashboard" | "tasks" | "review";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const navItems: { key: Page; label: string }[] = [
    { key: "dashboard", label: "进程监控" },
    { key: "tasks", label: "任务管理" },
    { key: "review", label: "审查闸门" },
  ];

  return (
    <div className="app">
      <nav className="sidebar">
        <h2>Agent Workbench</h2>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${page === item.key ? "active" : ""}`}
            onClick={() => setPage(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="content">
        {page === "dashboard" && <Dashboard />}
        {page === "tasks" && <Tasks />}
        {page === "review" && <Review />}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: 创建 App.css**

```css
:root {
  --bg: #0d1117;
  --bg-secondary: #161b22;
  --border: #30363d;
  --text: #c9d1d9;
  --text-muted: #8b949e;
  --accent: #1f6feb;
  --accent-hover: #388bfd;
  --danger: #da3633;
  --success: #238636;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}

.app {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 220px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar h2 {
  font-size: 16px;
  color: var(--text);
  margin-bottom: 16px;
  padding: 0 8px;
}

.nav-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
}

.nav-btn:hover { background: #1c2128; color: var(--text); }
.nav-btn.active { background: var(--accent); color: #fff; }

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.page h1 {
  font-size: 20px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.process-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.process-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
}

.process-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}
.status-dot.active { background: var(--success); }

.process-meta {
  display: flex;
  gap: 16px;
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 4px;
}

.process-model, .process-session {
  color: var(--text-muted);
  font-size: 11px;
  margin-top: 2px;
}

.empty {
  color: var(--text-muted);
  font-style: italic;
}

/* 任务列表 */
.task-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.task-card h3 {
  font-size: 15px;
  margin-bottom: 8px;
}

.task-meta {
  display: flex;
  gap: 24px;
  color: var(--text-muted);
  font-size: 12px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}
.badge-created { background: #30363d; color: var(--text-muted); }
.badge-running { background: #1a3a5c; color: #58a6ff; }
.badge-reviewing { background: #5c3a1a; color: #d29922; }
.badge-done { background: #1a3c2a; color: #3fb950; }
.badge-failed { background: #3c1a1a; color: var(--danger); }

/* 审查面板 */
.review-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover { background: var(--accent-hover); }

.btn-danger {
  background: var(--danger);
  color: #fff;
}

.btn-success {
  background: var(--success);
  color: #fff;
}

.diff-preview {
  background: #0d1117;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 12px;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
  margin: 12px 0;
}

/* 创建任务表单 */
.create-form {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.create-form textarea {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 10px;
  font-size: 14px;
  min-height: 80px;
  resize: vertical;
  margin-bottom: 12px;
  font-family: inherit;
}

.create-form textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.form-row input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 8px 12px;
  font-size: 14px;
}

.form-row input:focus {
  outline: none;
  border-color: var(--accent);
}
```

- [ ] **Step 6: 编译前端**

```bash
cd tools/agent-workbench && npm install && npm run build
```
Expected: Build succeeds.

---

## Phase 10: 前端 — Tasks 页面（任务创建 + 列表）

### Task 10.1: Tasks 页面

**Files:**
- Create: `tools/agent-workbench/src/pages/Tasks.tsx`

- [ ] **Step 1: 创建 Tasks.tsx**

```tsx
// tools/agent-workbench/src/pages/Tasks.tsx
import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../types";

function statusLabel(s: string): string {
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed === "object" && parsed !== null) {
      if ("running" in parsed) return `运行中 (第 ${parsed.running.round} 轮)`;
      if ("reviewing" in parsed) return `待审查 (第 ${parsed.reviewing.round} 轮)`;
      if ("failed" in parsed) return `失败: ${parsed.failed.reason}`;
    }
  } catch {}
  return s;
}

function statusClass(s: string): string {
  if (s.includes("running")) return "badge-running";
  if (s.includes("reviewing")) return "badge-reviewing";
  if (s.includes("done")) return "badge-done";
  if (s.includes("failed")) return "badge-failed";
  return "badge-created";
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("deepseek/deepseek-v4-pro");
  const [loading, setLoading] = useState(true);

  const refreshTasks = useCallback(() => {
    invoke<Task[]>("get_tasks")
      .then(setTasks)
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshTasks();
    setLoading(false);
    const timer = setInterval(refreshTasks, 10000);
    return () => clearInterval(timer);
  }, [refreshTasks]);

  const handleCreate = async () => {
    if (!prompt.trim()) return;
    try {
      await invoke("create_task", { prompt: prompt.trim(), model });
      setPrompt("");
      refreshTasks();
    } catch (e) {
      console.error("创建任务失败:", e);
    }
  };

  return (
    <div className="page tasks">
      <h1>任务管理</h1>

      <div className="create-form">
        <h3 style={{ marginBottom: 8 }}>创建新任务</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入 Agent 指令，如：修复 apps/ftg/client 中的所有类型错误"
        />
        <div className="form-row">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="模型 (如 deepseek/deepseek-v4-pro)"
          />
          <button className="btn btn-primary" onClick={handleCreate}>
            创建任务
          </button>
        </div>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : tasks.length === 0 ? (
        <p className="empty">暂无任务</p>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="task-card">
            <h3>
              {task.id.slice(0, 8)} — {task.prompt.slice(0, 60)}
              {task.prompt.length > 60 ? "..." : ""}
            </h3>
            <div className="task-meta">
              <span className={`badge ${statusClass(task.status)}`}>
                {statusLabel(task.status)}
              </span>
              <span>分支: {task.branch_name}</span>
              <span>模型: {task.model}</span>
              <span>轮次: {task.rounds.length}</span>
              <span>
                创建: {new Date(task.created_at).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: 编译验证**

```bash
cd tools/agent-workbench && npm run build
```
Expected: Build succeeds.

---

## Phase 11: 前端 — Review 页面（审查闸门）

### Task 11.1: Review 页面

**Files:**
- Create: `tools/agent-workbench/src/pages/Review.tsx`

- [ ] **Step 1: 创建 Review.tsx**

```tsx
// tools/agent-workbench/src/pages/Review.tsx
import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PendingReview {
  0: string;  // task_id
  1: number;  // round
  2: string;  // diff_preview
  3: string;  // diff_hash
}

export default function Review() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    invoke<PendingReview[]>("get_pending_reviews")
      .then(setReviews)
      .catch(console.error);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleApprove = async (taskId: string) => {
    try {
      await invoke("approve_review", { taskId });
      refresh();
    } catch (e) {
      console.error("批准失败:", e);
    }
  };

  const handleReject = async (taskId: string) => {
    const reason = rejectReason[taskId] || "无具体原因";
    try {
      await invoke("reject_review", { taskId, reason });
      setRejectReason((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
      refresh();
    } catch (e) {
      console.error("拒绝失败:", e);
    }
  };

  return (
    <div className="page review">
      <h1>审查闸门</h1>

      {reviews.length === 0 ? (
        <p className="empty">没有待审查的任务</p>
      ) : (
        reviews.map(([taskId, round, diffPreview, diffHash]) => (
          <div key={taskId} className="task-card">
            <h3>
              任务 {taskId.slice(0, 8)} — 第 {round} 轮
            </h3>
            <div className="task-meta">
              <span className="badge badge-reviewing">待审查</span>
              <span>Diff: {diffHash.slice(0, 16)}...</span>
            </div>
            <div className="diff-preview">{diffPreview}</div>
            <div className="review-actions">
              <button
                className="btn btn-success"
                onClick={() => handleApprove(taskId)}
              >
                批准合并
              </button>
              <input
                placeholder="拒绝原因（可选）"
                value={rejectReason[taskId] || ""}
                onChange={(e) =>
                  setRejectReason((prev) => ({
                    ...prev,
                    [taskId]: e.target.value,
                  }))
                }
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--text)",
                  padding: "8px 12px",
                  fontSize: "14px",
                }}
              />
              <button
                className="btn btn-danger"
                onClick={() => handleReject(taskId)}
              >
                拒绝（重新执行本轮）
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: 编译前端**

```bash
cd tools/agent-workbench && npm run build
```
Expected: Build succeeds.

---

## Phase 12: 集成测试 + 首次启动验证

### Task 12.1: 端到端验证

- [ ] **Step 1: 完整编译后端**

```bash
cd tools/agent-workbench && cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: Compilation succeeds with zero errors.

- [ ] **Step 2: 运行所有单元测试**

```bash
cd tools/agent-workbench && cargo test --manifest-path src-tauri/Cargo.toml
```
Expected: All tests pass.

- [ ] **Step 3: 编译完整 Tauri 应用**

```bash
cd tools/agent-workbench && npm install && npx tauri build
```
Expected: 生成 `src-tauri/target/release/agent-workbench.exe`，大小约 10-15 MB。

- [ ] **Step 4: 启动验证**

```bash
cd tools/agent-workbench && npx tauri dev
```
Expected: 窗口正常打开，Dashboard/Tasks/Review 三个页面可切换。

---

## 附录：后续迭代计划（不在此次实现范围）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| Session 自动关联（从 opencode DB 读取） | P1 | 复刻旧版 process_monitor 的 `_link_session` 逻辑 |
| Worktree 管理页面（手动创建/清理） | P2 | 可视化 .worktrees/ 目录 |
| 会话历史回顾（成本/Token 图表） | P2 | 从 opencode.db message 表聚合 |
| 收敛自动检测（改动量下降 70% → 自动标记 done） | P2 | `GitOps::is_converging` 已实现，需接入事件 |
| 多项目配置切换 | P3 | 支持切换不同仓库路径 |
| 通知系统（Windows toast / 声音提示） | P3 | 审查队列有新任务时提醒 |
