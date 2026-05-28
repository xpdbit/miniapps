# -*- coding: utf-8 -*-
"""
opencode_db_reader.py — OpenCode SQLite 数据库读取器
从 OpenCode 的本地 SQLite 数据库中提取会话、Agent、Token 等监控数据。

用法:
    reader = OpencodeDBReader()
    sessions = reader.list_sessions(days=7)
    detail = reader.get_session_detail("ses_xxx")
    stats = reader.get_daily_stats(days=30)
"""

import json
import os
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple


# ─── 数据模型 ──────────────────────────────────


@dataclass
class SessionRecord:
    """OpenCode 会话记录"""
    session_id: str
    project_id: str
    parent_id: Optional[str]
    slug: str
    title: str
    summary_additions: int = 0
    summary_deletions: int = 0
    summary_files: int = 0
    time_created: int = 0
    time_updated: int = 0
    time_compacting: Optional[int] = None
    duration_ms: int = 0

    # 聚合数据（从 message 表计算）
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_tokens_reasoning: int = 0
    total_tokens_cache_read: int = 0
    total_tokens_cache_write: int = 0
    total_cost: float = 0.0
    model_id: str = ""
    provider_id: str = ""
    agent_name: str = ""
    message_count: int = 0

    # 批量聚合临时字段（非持久化，init=False）
    _model_set: set = field(default_factory=set, init=False, repr=False)
    _provider_set: set = field(default_factory=set, init=False, repr=False)
    _agent_set: set = field(default_factory=set, init=False, repr=False)

    @property
    def duration_s(self) -> float:
        return self.duration_ms / 1000.0

    @property
    def created_dt(self) -> datetime:
        return datetime.fromtimestamp(self.time_created / 1000, tz=timezone.utc)

    @property
    def is_subagent(self) -> bool:
        return bool(self.parent_id)

    @property
    def total_tokens(self) -> int:
        return self.total_tokens_input + self.total_tokens_output + self.total_tokens_reasoning


@dataclass
class AgentSessionRecord:
    """子 Agent 会话记录（用于树形展示）"""
    session_id: str
    parent_id: Optional[str]
    title: str
    agent_type: str = ""
    model_id: str = ""
    provider_id: str = ""
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_tokens_reasoning: int = 0
    total_cost: float = 0.0
    time_created: int = 0
    time_updated: int = 0
    duration_ms: int = 0
    level: int = 0
    children: List['AgentSessionRecord'] = field(default_factory=list)


@dataclass
class DailyStats:
    """每日统计"""
    date: str
    sessions_total: int = 0
    sessions_main: int = 0     # 无 parent 的主会话
    sessions_sub: int = 0      # 有 parent 的子 agent 会话
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_tokens_reasoning: int = 0
    total_tokens_cache: int = 0
    total_cost: float = 0.0
    total_duration_s: float = 0.0
    unique_models: int = 0
    unique_agents: int = 0
    files_changed: int = 0


@dataclass
class ModelStats:
    """模型使用统计"""
    model_id: str
    provider_id: str
    sessions_count: int = 0
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_tokens_reasoning: int = 0
    total_cost: float = 0.0
    total_duration_ms: int = 0

    @property
    def avg_cost_per_session(self) -> float:
        if self.sessions_count == 0:
            return 0.0
        return self.total_cost / self.sessions_count


@dataclass
class SummaryStats:
    """总体统计摘要"""
    total_sessions: int = 0
    total_sessions_main: int = 0
    total_sessions_sub: int = 0
    total_tokens_input: int = 0
    total_tokens_output: int = 0
    total_tokens_reasoning: int = 0
    total_cost: float = 0.0
    total_duration_s: float = 0.0
    total_files_changed: int = 0
    avg_tokens_per_session: float = 0.0
    avg_cost_per_session: float = 0.0
    unique_models: int = 0
    unique_agent_types: int = 0


# ─── 数据库读取器 ──────────────────────────────


class OpencodeDBReader:
    """OpenCode SQLite 数据库读取器

    自动检测 opencode 数据库位置，提供会话、Agent、Token 等数据的读取方法。
    线程安全：每次查询创建独立的数据库连接。
    """

    # OpenCode DB 可能的路径
    _DB_CANDIDATES = [
        # Windows
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "opencode", "opencode.db"),
        # Linux/macOS (XDG)
        os.path.join(os.path.expanduser("~"), ".local", "share", "opencode", "opencode.db"),
        # macOS fallback
        os.path.join(os.path.expanduser("~"), "Library", "Application Support", "opencode", "opencode.db"),
        # Windows Roaming fallback
        os.path.join(os.environ.get("APPDATA", ""), "opencode", "opencode.db"),
    ]

    def __init__(self, db_path: Optional[str] = None):
        """初始化读取器

        Args:
            db_path: 可选，直接指定 opencode.db 路径。
                     不指定时自动检测已知路径。
        """
        self._db_path: Optional[str] = None
        if db_path:
            if os.path.isfile(db_path):
                self._db_path = db_path
        else:
            self._db_path = self.find_db_path()

        if not self._db_path:
            # 最后尝试：从 opencode 环境变量或进程查找
            self._db_path = self._find_from_running_opencode()

        self._project_cache: Dict[str, str] = {}  # project_id -> worktree path
        # list_sessions 两级缓存：(days, limit) → (timestamp, [SessionRecord])
        self._sessions_cache: Dict[Tuple[int, int], Tuple[float, List[SessionRecord]]] = {}
        self._sessions_cache_ttl: float = 30.0  # 30 秒内复用（减少 UI 刷新时的重复查询）
        self._last_db_mtime: float = 0.0  # 数据库文件最后修改时间，用于智能失效

    # ─── 连接与发现 ──────────────────────────────

    @property
    def db_path(self) -> Optional[str]:
        return self._db_path

    def is_available(self) -> bool:
        """检查 OpenCode 数据库是否可用"""
        return self._db_path is not None and os.path.isfile(self._db_path)

    def refresh_db_path(self) -> bool:
        """重新扫描 DB 路径（运行时调用，检测新启动的 opencode 进程）

        当 opencode 进程在 reader 创建后才启动时，调用此方法
        可以发现其实际使用的数据库路径。

        Returns:
            True 表示路径有变化，False 表示未变化
        """
        old_path = self._db_path
        new_path = self.find_db_path()
        if new_path and new_path != old_path:
            self._db_path = new_path
            self.invalidate_cache()
            return True
        return False

    def find_db_path(self) -> Optional[str]:
        """自动检测 OpenCode 数据库文件路径

        检测优先级：
        1. 运行中 opencode 进程实际使用的 DB（从文件句柄发现）
        2. 标准路径（XDG/LocalAppData/Roaming）
        3. opencode 配置中的 dataDir
        """
        # 优先级1: 运行中 opencode 进程使用的 DB
        proc_db = self._find_db_from_running_processes()
        if proc_db:
            return proc_db

        # 优先级2: 标准路径
        for path in self._DB_CANDIDATES:
            if path and os.path.isfile(path):
                return path

        # 优先级3: 标准路径的额外变体
        home = os.path.expanduser("~")
        alt_paths = [
            os.path.join(home, ".local", "share", "opencode", "opencode.db"),
        ]
        for p in alt_paths:
            if os.path.isfile(p):
                return p

        # 优先级4: 从 opencode 配置推断
        return self._find_from_running_opencode()

    @staticmethod
    def _find_db_from_running_processes() -> Optional[str]:
        """从运行中的 opencode 进程的文件句柄发现实际使用的 DB

        当 opencode 使用非标准数据目录时（如自定义安装路径），
        其 SQLite 数据库文件句柄揭示真实路径。
        """
        try:
            import psutil
            _PROC_NAMES = {"opencode", "opencode.exe"}
            db_paths: Set[str] = set()

            for proc in psutil.process_iter(['pid', 'name']):
                name = proc.info.get('name', '')
                if not name or name.lower() not in _PROC_NAMES:
                    continue
                try:
                    p = psutil.Process(proc.info['pid'])
                    for f in p.open_files():
                        fp = f.path.lower()
                        # 寻找 opencode.db (排除 -wal, -shm 等附属文件)
                        if fp.endswith('opencode.db') and not any(
                            fp.endswith(sfx) for sfx in ('-wal', '-shm', '-journal')
                        ):
                            db_paths.add(f.path)
                except Exception:
                    continue

            # 返回最新修改的 DB（活跃进程的 DB 通常最新）
            if db_paths:
                best = max(db_paths, key=lambda p: os.path.getmtime(p) if os.path.isfile(p) else 0)
                if os.path.isfile(best):
                    return best
        except ImportError:
            pass
        except Exception:
            pass
        return None

    def _find_from_running_opencode(self) -> Optional[str]:
        """从运行中的 opencode 进程推断数据库路径（回退方案）"""
        # 尝试读取 opencode 配置
        config_path = os.path.join(
            os.environ.get("XDG_CONFIG_HOME",
                           os.path.join(os.path.expanduser("~"), ".config")),
            "opencode", "opencode.json"
        )
        if os.path.isfile(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                data_dir = config.get("dataDir", "")
                if data_dir and os.path.isdir(data_dir):
                    db = os.path.join(data_dir, "opencode.db")
                    if os.path.isfile(db):
                        return db
            except Exception:
                pass
        return None

    def _connect(self) -> Optional[sqlite3.Connection]:
        """创建到 OpenCode 数据库的只读连接（性能优化版）

        优化措施:
        - WAL 模式 + NORMAL synchronous（减少同步 I/O）
        - mmap_size 64MB（内存映射 I/O，比 read() 快）
        - cache_size -16000（16MB 页面缓存）
        - read_uncommitted（允许脏读，大幅减少锁等待）
        - 2 秒超时（快速失败，不阻塞调用方）
        """
        if not self._db_path:
            return None
        try:
            conn = sqlite3.connect(
                self._db_path,
                timeout=2,
                check_same_thread=False,
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA query_only = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA mmap_size = 67108864")        # 64MB
            conn.execute("PRAGMA cache_size = -16000")         # 16MB
            conn.execute("PRAGMA read_uncommitted = ON")
            conn.execute("PRAGMA temp_store = MEMORY")
            return conn
        except (sqlite3.Error, OSError):
            return None

    def _get_project_path(self, project_id: str) -> str:
        """从 project 表获取项目路径"""
        if not self._project_cache:
            self._load_project_cache()
        return self._project_cache.get(project_id, project_id)

    def _load_project_cache(self):
        """加载 project 表到缓存"""
        conn = self._connect()
        if not conn:
            return
        try:
            cursor = conn.execute(
                "SELECT id, worktree, name FROM project"
            )
            for row in cursor.fetchall():
                pid = row["id"]
                worktree = row["worktree"] or ""
                name = row["name"] or ""
                if worktree:
                    self._project_cache[pid] = worktree
                elif name:
                    self._project_cache[pid] = name
        finally:
            conn.close()

    def _parse_message_tokens(self, data: dict) -> dict:
        """从 message 的 data JSON 中提取 token/成本信息"""
        result = {
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_reasoning": 0,
            "tokens_cache_read": 0,
            "tokens_cache_write": 0,
            "cost": 0.0,
            "model_id": "",
            "provider_id": "",
            "agent_name": "",
            "mode": "",
            "time_created": 0,
            "time_completed": 0,
        }

        if not isinstance(data, dict):
            return result

        # 提取角色
        role = data.get("role", "")
        if role != "assistant":
            return result  # 只统计 assistant 消息

        # 提取 agent 名称
        result["agent_name"] = data.get("mode", "") or data.get("agent", "")

        # 提取模型
        result["model_id"] = data.get("modelID", "")
        result["provider_id"] = data.get("providerID", "")

        # 提取 tokens
        tokens = data.get("tokens", {})
        if isinstance(tokens, dict):
            result["tokens_input"] = tokens.get("input", 0) or 0
            result["tokens_output"] = tokens.get("output", 0) or 0
            result["tokens_reasoning"] = tokens.get("reasoning", 0) or 0
            cache = tokens.get("cache", {}) or {}
            if isinstance(cache, dict):
                result["tokens_cache_read"] = cache.get("read", 0) or 0
                result["tokens_cache_write"] = cache.get("write", 0) or 0

        # 提取 cost
        cost = data.get("cost", 0) or 0
        try:
            result["cost"] = float(cost)
        except (ValueError, TypeError):
            result["cost"] = 0.0

        # 提取时间
        time_info = data.get("time", {}) or {}
        if isinstance(time_info, dict):
            result["time_created"] = time_info.get("created", 0) or 0
            result["time_completed"] = time_info.get("completed", 0) or 0

        return result

    # ─── 会话查询 ──────────────────────────────

    def list_sessions(self, days: int = 7, limit: int = 100) -> List[SessionRecord]:
        """获取最近的会话列表（带短期缓存，避免同一刷新周期重复查询）

        Args:
            days: 获取最近 N 天的会话
            limit: 最多返回条数

        Returns:
            SessionRecord 列表，按时间倒序
        """
        # 智能缓存：检查 DB 文件是否被修改（有新数据写入时自动失效）
        cache_key = (days, limit)
        now = time.time()
        db_mtime = os.path.getmtime(self._db_path) if self._db_path and os.path.isfile(self._db_path) else 0
        if cache_key in self._sessions_cache:
            cached_time, cached_data = self._sessions_cache[cache_key]
            cache_valid = (now - cached_time < self._sessions_cache_ttl)
            db_unchanged = (db_mtime <= self._last_db_mtime)
            if cache_valid and (db_unchanged or now - cached_time < 5):
                # 缓存未过期且 DB 未变化，直接返回
                # 即使 DB 变了，5 秒内的缓存也保留（避免高频刷新）
                return cached_data

        conn = self._connect()
        if not conn:
            return []

        try:
            cutoff = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)

            cursor = conn.execute("""
                SELECT id, project_id, parent_id, slug, title,
                       summary_additions, summary_deletions, summary_files,
                       time_created, time_updated, time_compacting
                FROM session
                WHERE time_created >= ?
                ORDER BY time_created DESC
                LIMIT ?
            """, (cutoff, limit))

            sessions = []
            for row in cursor.fetchall():
                sess = SessionRecord(
                    session_id=row["id"],
                    project_id=self._get_project_path(row["project_id"]),
                    parent_id=row["parent_id"],
                    slug=row["slug"],
                    title=row["title"] or "",
                    summary_additions=row["summary_additions"] or 0,
                    summary_deletions=row["summary_deletions"] or 0,
                    summary_files=row["summary_files"] or 0,
                    time_created=row["time_created"] or 0,
                    time_updated=row["time_updated"] or 0,
                    time_compacting=row["time_compacting"],
                    duration_ms=(row["time_updated"] or row["time_created"] or 0) -
                                (row["time_created"] or 0),
                )
                sessions.append(sess)

            # 批量填充 token 数据
            self._batch_fill_token_stats(conn, sessions)

            # 写入缓存
            self._sessions_cache[cache_key] = (now, sessions)
            self._last_db_mtime = db_mtime

            return sessions
        finally:
            conn.close()

    def invalidate_cache(self):
        """清除会话缓存（DB 路径变更时调用）"""
        self._sessions_cache.clear()
        self._project_cache.clear()

    def _batch_fill_token_stats(self, conn: sqlite3.Connection, sessions: List[SessionRecord]):
        """批量从 message 表填充 token/cost 统计数据（单次 IN 查询替代 N+1）"""
        if not sessions:
            return

        # 建立 session_id → SessionRecord 映射
        sid_map: Dict[str, SessionRecord] = {s.session_id: s for s in sessions}
        # 重置临时聚合容器
        for s in sessions:
            s._model_set.clear()
            s._provider_set.clear()
            s._agent_set.clear()

        # 分批执行 IN 查询（SQLite 默认参数上限 999，每批 500）
        sids = list(sid_map.keys())
        batch_size = 500
        for i in range(0, len(sids), batch_size):
            batch = sids[i:i + batch_size]
            placeholders = ",".join("?" * len(batch))
            try:
                cursor = conn.execute(
                    f"SELECT session_id, data FROM message WHERE session_id IN ({placeholders})",
                    batch,
                )
                for row in cursor.fetchall():
                    sid = row["session_id"]
                    if sid not in sid_map:
                        continue
                    sess = sid_map[sid]
                    raw = row["data"]
                    if not raw:
                        continue
                    try:
                        data = json.loads(raw) if isinstance(raw, str) else raw
                    except (json.JSONDecodeError, TypeError):
                        continue

                    parsed = self._parse_message_tokens(data)
                    if not parsed["model_id"] and not parsed["tokens_input"]:
                        continue  # 跳过非 assistant 消息

                    sess.message_count += 1
                    sess.total_tokens_input += parsed["tokens_input"]
                    sess.total_tokens_output += parsed["tokens_output"]
                    sess.total_tokens_reasoning += parsed["tokens_reasoning"]
                    sess.total_tokens_cache_read += parsed["tokens_cache_read"]
                    sess.total_tokens_cache_write += parsed["tokens_cache_write"]
                    sess.total_cost += parsed["cost"]
                    if parsed["model_id"]:
                        sess._model_set.add(parsed["model_id"])
                    if parsed["provider_id"]:
                        sess._provider_set.add(parsed["provider_id"])
                    if parsed["agent_name"]:
                        sess._agent_set.add(parsed["agent_name"])
            except sqlite3.Error:
                continue

        # 汇总 set → string
        for s in sessions:
            s.model_id = ", ".join(sorted(s._model_set)) if s._model_set else ""
            s.provider_id = ", ".join(sorted(s._provider_set)) if s._provider_set else ""
            s.agent_name = ", ".join(sorted(s._agent_set)) if s._agent_set else ""

    def get_session_detail(self, session_id: str) -> Optional[SessionRecord]:
        """获取单个会话的详细信息"""
        conn = self._connect()
        if not conn:
            return None

        try:
            cursor = conn.execute("""
                SELECT id, project_id, parent_id, slug, title,
                       summary_additions, summary_deletions, summary_files,
                       time_created, time_updated, time_compacting
                FROM session
                WHERE id = ?
            """, (session_id,))
            row = cursor.fetchone()
            if not row:
                return None

            sess = SessionRecord(
                session_id=row["id"],
                project_id=self._get_project_path(row["project_id"]),
                parent_id=row["parent_id"],
                slug=row["slug"],
                title=row["title"] or "",
                summary_additions=row["summary_additions"] or 0,
                summary_deletions=row["summary_deletions"] or 0,
                summary_files=row["summary_files"] or 0,
                time_created=row["time_created"] or 0,
                time_updated=row["time_updated"] or 0,
                time_compacting=row["time_compacting"],
                duration_ms=(row["time_updated"] or row["time_created"] or 0) -
                            (row["time_created"] or 0),
            )
            self._batch_fill_token_stats(conn, [sess])
            return sess
        finally:
            conn.close()

    # ─── Agent 层级查询 ──────────────────────────

    def get_agent_hierarchy(self, parent_session_id: str,
                            max_depth: int = 10) -> List[AgentSessionRecord]:
        """递归获取一个主会话的所有子 Agent 层级

        Args:
            parent_session_id: 主会话 ID
            max_depth: 最大递归深度

        Returns:
            树形 AgentSessionRecord 列表（根级）
        """
        conn = self._connect()
        if not conn:
            return []

        def _build_tree(session_id: str, depth: int = 0) -> List[AgentSessionRecord]:
            if depth >= max_depth:
                return []
            try:
                cursor = conn.execute("""
                    SELECT id, project_id, parent_id, slug, title,
                           summary_additions, summary_deletions, summary_files,
                           time_created, time_updated
                    FROM session
                    WHERE parent_id = ?
                    ORDER BY time_created ASC
                """, (session_id,))
                results = []
                for row in cursor.fetchall():
                    rec = AgentSessionRecord(
                        session_id=row["id"],
                        parent_id=row["parent_id"],
                        title=self._extract_agent_title(row["title"] or ""),
                        time_created=row["time_created"] or 0,
                        time_updated=row["time_updated"] or 0,
                        duration_ms=(row["time_updated"] or 0) - (row["time_created"] or 0),
                        level=depth + 1,
                    )
                    # 提取 agent 类型（从 title 中的 @xxx 标记）
                    rec.agent_type = self.extract_agent_type(row["title"] or "")
                    # 填充 token 统计
                    self._fill_agent_token_stats(conn, rec)
                    # 递归子节点
                    rec.children = _build_tree(rec.session_id, depth + 1)
                    results.append(rec)
                return results
            except sqlite3.Error:
                return []

        return _build_tree(parent_session_id)

    def _fill_agent_token_stats(self, conn: sqlite3.Connection, rec: AgentSessionRecord):
        """为单个 agent 记录填充 token 统计"""
        try:
            cursor = conn.execute("""
                SELECT data FROM message WHERE session_id = ?
            """, (rec.session_id,))
            for row in cursor.fetchall():
                raw = row["data"]
                if not raw:
                    continue
                try:
                    data = json.loads(raw) if isinstance(raw, str) else raw
                except (json.JSONDecodeError, TypeError):
                    continue
                parsed = self._parse_message_tokens(data)
                rec.total_tokens_input += parsed["tokens_input"]
                rec.total_tokens_output += parsed["tokens_output"]
                rec.total_tokens_reasoning += parsed["tokens_reasoning"]
                rec.total_cost += parsed["cost"]
                if parsed["model_id"] and not rec.model_id:
                    rec.model_id = parsed["model_id"]
                if parsed["provider_id"] and not rec.provider_id:
                    rec.provider_id = parsed["provider_id"]
        except sqlite3.Error:
            pass

    @staticmethod
    def extract_agent_type(title: str) -> str:
        """从会话标题中提取 agent 类型（如 @explore, @oracle）
        
        提取优先级：
        1. @xxx 标记（如 "Verify task (@oracle subagent)" → "oracle"）
        2. 标题前缀常见 agent 类型关键词（如 "Explore ", "Oracle " → 相应类型）
        3. 回退到空字符串（表示非子 agent 的主会话）
        """
        import re
        # 优先级1: @xxx 标记
        m = re.search(r'@(\w+)', title)
        if m:
            return m.group(1)

        # 优先级2: 标题以 agent 类型关键词开头
        prefix_match = re.match(
            r'^(Explore|Oracle|Librarian|Metis|Momus|Plan|Sisyphus|Prometheus)\b',
            title, re.IGNORECASE
        )
        if prefix_match:
            return prefix_match.group(1).lower()

        return ""

    @staticmethod
    def _extract_agent_title(title: str) -> str:
        """清理 agent 标题，去除 @xxx 后缀"""
        import re
        return re.sub(r'\s*\(@\w+.*\)$', '', title).strip()

    # ─── 统计分析 ──────────────────────────────

    def get_daily_stats(self, days: int = 30) -> List[DailyStats]:
        """获取每日统计汇总

        Args:
            days: 统计最近 N 天

        Returns:
            按日期倒序的 DailyStats 列表
        """
        sessions = self.list_sessions(days=days, limit=10000)

        daily_map: Dict[str, DailyStats] = {}

        for sess in sessions:
            date_key = sess.created_dt.strftime("%Y-%m-%d")
            if date_key not in daily_map:
                daily_map[date_key] = DailyStats(date=date_key)

            ds = daily_map[date_key]
            ds.sessions_total += 1
            if sess.is_subagent:
                ds.sessions_sub += 1
            else:
                ds.sessions_main += 1
            ds.total_tokens_input += sess.total_tokens_input
            ds.total_tokens_output += sess.total_tokens_output
            ds.total_tokens_reasoning += sess.total_tokens_reasoning
            ds.total_tokens_cache += sess.total_tokens_cache_read
            ds.total_cost += sess.total_cost
            ds.total_duration_s += sess.duration_s
            ds.files_changed += sess.summary_files

            # 为每天的统计数据补充唯一模型和 agent 类型计数
            if sess.model_id:
                ds.unique_models += 1
            if sess.agent_name:
                ds.unique_agents += 1

        return sorted(daily_map.values(), key=lambda x: x.date, reverse=True)

    def get_model_stats(self, days: int = 30) -> List[ModelStats]:
        """获取模型使用统计"""
        conn = self._connect()
        if not conn:
            return []

        try:
            cutoff = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
            model_map: Dict[str, ModelStats] = {}

            cursor = conn.execute("""
                SELECT id FROM session
                WHERE time_created >= ?
            """, (cutoff,))
            session_ids = [row["id"] for row in cursor.fetchall()]

            for sid in session_ids:
                try:
                    msg_cursor = conn.execute("""
                        SELECT data FROM message WHERE session_id = ?
                    """, (sid,))
                    for row in msg_cursor.fetchall():
                        raw = row["data"]
                        if not raw:
                            continue
                        try:
                            data = json.loads(raw) if isinstance(raw, str) else raw
                        except (json.JSONDecodeError, TypeError):
                            continue
                        parsed = self._parse_message_tokens(data)
                        if not parsed["model_id"]:
                            continue

                        key = f"{parsed['provider_id']}/{parsed['model_id']}"
                        if key not in model_map:
                            model_map[key] = ModelStats(
                                model_id=parsed["model_id"],
                                provider_id=parsed["provider_id"],
                            )
                        ms = model_map[key]
                        ms.sessions_count += 1
                        ms.total_tokens_input += parsed["tokens_input"]
                        ms.total_tokens_output += parsed["tokens_output"]
                        ms.total_tokens_reasoning += parsed["tokens_reasoning"]
                        ms.total_cost += parsed["cost"]
                        ms.total_duration_ms += parsed["time_completed"] - parsed["time_created"]
                except sqlite3.Error:
                    continue

            return sorted(model_map.values(), key=lambda x: x.total_cost, reverse=True)
        finally:
            conn.close()

    def get_agent_type_stats(self, days: int = 30) -> List[dict]:
        """获取 Agent 类型使用统计"""
        sessions = self.list_sessions(days=days, limit=10000)

        type_map: Dict[str, dict] = {}
        for sess in sessions:
            if not sess.parent_id:
                continue  # 只统计子 agent
            # 从 title 中提取 agent 类型
            atype = self.extract_agent_type(sess.title)
            if not atype:
                atype = "unknown"

            if atype not in type_map:
                type_map[atype] = {
                    "agent_type": atype,
                    "sessions": 0,
                    "total_tokens": 0,
                    "total_cost": 0.0,
                    "total_duration_ms": 0,
                }
            entry = type_map[atype]
            entry["sessions"] += 1
            entry["total_tokens"] += sess.total_tokens
            entry["total_cost"] += sess.total_cost
            entry["total_duration_ms"] += sess.duration_ms

        return sorted(type_map.values(), key=lambda x: x["sessions"], reverse=True)

    def get_summary_stats(self, days: int = 7) -> SummaryStats:
        """获取总体统计摘要"""
        sessions = self.list_sessions(days=days, limit=10000)

        stats = SummaryStats()
        models = set()
        agent_types = set()

        for sess in sessions:
            stats.total_sessions += 1
            if sess.is_subagent:
                stats.total_sessions_sub += 1
                atype = self.extract_agent_type(sess.title)
                if atype:
                    agent_types.add(atype)
            else:
                stats.total_sessions_main += 1
            stats.total_tokens_input += sess.total_tokens_input
            stats.total_tokens_output += sess.total_tokens_output
            stats.total_tokens_reasoning += sess.total_tokens_reasoning
            stats.total_cost += sess.total_cost
            stats.total_duration_s += sess.duration_s
            stats.total_files_changed += sess.summary_files
            if sess.model_id:
                models.update(sess.model_id.split(", "))

        stats.unique_models = len(models)
        stats.unique_agent_types = len(agent_types)
        if stats.total_sessions > 0:
            stats.avg_tokens_per_session = (
                (stats.total_tokens_input + stats.total_tokens_output + stats.total_tokens_reasoning)
                / stats.total_sessions
            )
            stats.avg_cost_per_session = stats.total_cost / stats.total_sessions

        return stats

    def search_sessions(self, query: str, limit: int = 50) -> List[SessionRecord]:
        """搜索会话（按标题、slug 模糊匹配）"""
        conn = self._connect()
        if not conn:
            return []

        try:
            pattern = f"%{query}%"
            cursor = conn.execute("""
                SELECT id, project_id, parent_id, slug, title,
                       summary_additions, summary_deletions, summary_files,
                       time_created, time_updated, time_compacting
                FROM session
                WHERE title LIKE ? OR slug LIKE ? OR id LIKE ?
                ORDER BY time_created DESC
                LIMIT ?
            """, (pattern, pattern, pattern, limit))

            sessions = []
            for row in cursor.fetchall():
                sess = SessionRecord(
                    session_id=row["id"],
                    project_id=self._get_project_path(row["project_id"]),
                    parent_id=row["parent_id"],
                    slug=row["slug"],
                    title=row["title"] or "",
                    summary_additions=row["summary_additions"] or 0,
                    summary_deletions=row["summary_deletions"] or 0,
                    summary_files=row["summary_files"] or 0,
                    time_created=row["time_created"] or 0,
                    time_updated=row["time_updated"] or 0,
                    time_compacting=row["time_compacting"],
                    duration_ms=(row["time_updated"] or row["time_created"] or 0) -
                                (row["time_created"] or 0),
                )
                sessions.append(sess)

            self._batch_fill_token_stats(conn, sessions)
            return sessions
        finally:
            conn.close()

    def refresh_projects(self):
        """刷新项目缓存"""
        self._project_cache.clear()
        self._load_project_cache()
