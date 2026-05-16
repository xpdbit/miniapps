# -*- coding: utf-8 -*-
"""
monitor_store.py — 监控数据持久化存储

将 OpencodeDB 抓取的历史数据和 AgentTracker 的实时追踪数据
持久化到本地 SQLite 数据库（state/monitor/monitor.db），
支持增量同步、去重和时序查询。

用法:
    store = MonitorStore(state_dir)
    store.record_real_time_agent(agent_id="...", agent_type="explore", ...)
    store.sync_from_opencode_db(reader)
    stats = store.get_daily_stats(days=7)
"""

import json
import os
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from .opencode_db_reader import OpencodeDBReader


# ─── Schema SQL ────────────────────────────────

_SCHEMA_SQL = """
-- 实时 Agent 追踪（从 AgentTracker 输出写入）
CREATE TABLE IF NOT EXISTS real_time_agents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    agent_type  TEXT NOT NULL DEFAULT '',
    model       TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'running',
    phase_name  TEXT NOT NULL DEFAULT '',
    preview     TEXT NOT NULL DEFAULT '',
    parent_id   TEXT NOT NULL DEFAULT '',
    start_time  REAL NOT NULL DEFAULT 0,
    end_time    REAL NOT NULL DEFAULT 0,
    session_tag TEXT NOT NULL DEFAULT '',
    recorded_at REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rta_agent_id ON real_time_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_rta_start ON real_time_agents(start_time);
CREATE INDEX IF NOT EXISTS idx_rta_type ON real_time_agents(agent_type);

-- 会话快照（从 opencode DB 同步）
CREATE TABLE IF NOT EXISTS session_snapshots (
    session_id          TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL DEFAULT '',
    parent_id           TEXT,
    slug                TEXT NOT NULL DEFAULT '',
    title               TEXT NOT NULL DEFAULT '',
    summary_additions   INTEGER NOT NULL DEFAULT 0,
    summary_deletions   INTEGER NOT NULL DEFAULT 0,
    summary_files       INTEGER NOT NULL DEFAULT 0,
    time_created        INTEGER NOT NULL DEFAULT 0,
    time_updated        INTEGER NOT NULL DEFAULT 0,
    duration_ms         INTEGER NOT NULL DEFAULT 0,
    total_tokens_input  INTEGER NOT NULL DEFAULT 0,
    total_tokens_output INTEGER NOT NULL DEFAULT 0,
    total_tokens_reasoning INTEGER NOT NULL DEFAULT 0,
    total_tokens_cache  INTEGER NOT NULL DEFAULT 0,
    total_cost          REAL NOT NULL DEFAULT 0.0,
    model_id            TEXT NOT NULL DEFAULT '',
    provider_id         TEXT NOT NULL DEFAULT '',
    agent_name          TEXT NOT NULL DEFAULT '',
    message_count       INTEGER NOT NULL DEFAULT 0,
    agent_type          TEXT NOT NULL DEFAULT '',
    synced_at           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ss_created ON session_snapshots(time_created);
CREATE INDEX IF NOT EXISTS idx_ss_parent ON session_snapshots(parent_id);
CREATE INDEX IF NOT EXISTS idx_ss_model ON session_snapshots(model_id);

-- Agent 会话层级（从 session 的 parent_id 构建）
CREATE TABLE IF NOT EXISTS agent_hierarchy (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL,
    parent_id       TEXT,
    root_session_id TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT '',
    agent_type      TEXT NOT NULL DEFAULT '',
    model_id        TEXT NOT NULL DEFAULT '',
    tokens_total    INTEGER NOT NULL DEFAULT 0,
    cost_total      REAL NOT NULL DEFAULT 0.0,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    level           INTEGER NOT NULL DEFAULT 0,
    synced_at       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ah_root ON agent_hierarchy(root_session_id);
CREATE INDEX IF NOT EXISTS idx_ah_session ON agent_hierarchy(session_id);

-- 每日聚合统计
CREATE TABLE IF NOT EXISTS daily_aggregates (
    date                TEXT PRIMARY KEY,
    sessions_total      INTEGER NOT NULL DEFAULT 0,
    sessions_main       INTEGER NOT NULL DEFAULT 0,
    sessions_sub        INTEGER NOT NULL DEFAULT 0,
    total_tokens_input  INTEGER NOT NULL DEFAULT 0,
    total_tokens_output INTEGER NOT NULL DEFAULT 0,
    total_tokens_reasoning INTEGER NOT NULL DEFAULT 0,
    total_tokens_cache  INTEGER NOT NULL DEFAULT 0,
    total_cost          REAL NOT NULL DEFAULT 0.0,
    total_duration_s    REAL NOT NULL DEFAULT 0.0,
    unique_models       INTEGER NOT NULL DEFAULT 0,
    unique_agents       INTEGER NOT NULL DEFAULT 0,
    files_changed       INTEGER NOT NULL DEFAULT 0,
    synced_at           INTEGER NOT NULL DEFAULT 0
);

-- 模型使用统计
CREATE TABLE IF NOT EXISTS model_usage (
    model_id            TEXT NOT NULL,
    date                TEXT NOT NULL,
    sessions_count      INTEGER NOT NULL DEFAULT 0,
    total_tokens_input  INTEGER NOT NULL DEFAULT 0,
    total_tokens_output INTEGER NOT NULL DEFAULT 0,
    total_tokens_reasoning INTEGER NOT NULL DEFAULT 0,
    total_cost          REAL NOT NULL DEFAULT 0.0,
    total_duration_ms   INTEGER NOT NULL DEFAULT 0,
    synced_at           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (model_id, date)
);

-- Agent 类型统计
CREATE TABLE IF NOT EXISTS agent_type_usage (
    agent_type      TEXT NOT NULL,
    date            TEXT NOT NULL,
    sessions_count  INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    total_cost      REAL NOT NULL DEFAULT 0.0,
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    synced_at       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent_type, date)
);
"""


class MonitorStore:
    """监控数据持久化存储

    线程安全：内部使用 RLock 保护所有写操作。
    数据存储于 state/monitor/monitor.db。
    """

    # 实时 agent 记录的 TTL（超过此时间的记录可清理）
    REAL_TIME_TTL = 86400 * 14  # 14 天

    def __init__(self, state_dir: str):
        self.state_dir = state_dir
        self._db_dir = os.path.join(state_dir, "monitor")
        self._db_path = os.path.join(self._db_dir, "monitor.db")
        self._lock = threading.RLock()

        os.makedirs(self._db_dir, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        """创建数据库连接"""
        conn = sqlite3.connect(self._db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        return conn

    def _init_db(self):
        """初始化数据库表结构"""
        with self._lock:
            conn = self._connect()
            try:
                conn.executescript(_SCHEMA_SQL)
                conn.commit()
            finally:
                conn.close()

    # ─── 实时 Agent 记录 ──────────────────────────

    def record_real_time_agent(self, agent_id: str, agent_type: str = "",
                                model: str = "", status: str = "running",
                                phase_name: str = "", preview: str = "",
                                parent_id: str = "",
                                start_time: float = 0.0,
                                end_time: float = 0.0,
                                session_tag: str = ""):
        """记录一条实时 Agent 追踪记录

        从 AgentTracker 的 feed_line/end_phase 回调中调用。
        每条唯一 agent_id 在 start 时写入，end 时更新。
        """
        if not agent_id:
            return
        now = time.time()

        with self._lock:
            conn = self._connect()
            try:
                # 检查是否已有该 agent 的记录
                cursor = conn.execute(
                    "SELECT id, start_time, status FROM real_time_agents "
                    "WHERE agent_id = ? ORDER BY id DESC LIMIT 1",
                    (agent_id,)
                )
                existing = cursor.fetchone()

                if existing and existing["status"] == "running":
                    # 更新已有记录
                    conn.execute(
                        "UPDATE real_time_agents SET status=?, end_time=?, "
                        "model=?, preview=?, phase_name=?, agent_type=? "
                        "WHERE id=?",
                        (status, end_time or now, model, preview,
                         phase_name, agent_type, existing["id"])
                    )
                else:
                    # 插入新记录
                    conn.execute(
                        "INSERT INTO real_time_agents "
                        "(agent_id, agent_type, model, status, phase_name, "
                        "preview, parent_id, start_time, end_time, "
                        "session_tag, recorded_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (agent_id, agent_type, model, status, phase_name,
                         preview, parent_id, start_time or now,
                         end_time or 0, session_tag, now)
                    )
                conn.commit()
            finally:
                conn.close()

    def get_real_time_agents(self, since: float = 0.0,
                              limit: int = 200) -> List[dict]:
        """获取实时 Agent 记录

        Args:
            since: 只返回此时间戳之后的记录
            limit: 最大条数

        Returns:
            记录字典列表
        """
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute(
                    "SELECT * FROM real_time_agents "
                    "WHERE (start_time >= ? OR end_time >= ?) "
                    "ORDER BY start_time DESC LIMIT ?",
                    (since, since, limit)
                )
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    def clean_real_time_agents(self, ttl: Optional[int] = None):
        """清理过期的实时 Agent 记录

        Args:
            ttl: 保留时长（秒），默认 14 天
        """
        ttl = ttl or self.REAL_TIME_TTL
        cutoff = time.time() - ttl
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    "DELETE FROM real_time_agents WHERE start_time < ?",
                    (cutoff,)
                )
                conn.commit()
            finally:
                conn.close()

    # ─── 会话快照同步 ──────────────────────────

    def sync_from_opencode_db(self, reader: OpencodeDBReader,
                               days: int = 7):
        """从 OpencodeDBReader 同步会话数据到本地存储

        Args:
            reader: 已初始化的 OpencodeDBReader
            days: 同步最近 N 天的数据
        """
        if not reader.is_available():
            return

        now_ts = int(time.time() * 1000)

        with self._lock:
            conn = self._connect()
            try:
                # 1. 同步会话快照
                sessions = reader.list_sessions(days=days, limit=5000)
                for sess in sessions:
                    # 提取 agent 类型
                    agent_type = reader._extract_agent_type(sess.title) if hasattr(
                        reader, '_extract_agent_type') else ""

                    conn.execute("""
                        INSERT OR REPLACE INTO session_snapshots
                        (session_id, project_id, parent_id, slug, title,
                         summary_additions, summary_deletions, summary_files,
                         time_created, time_updated, duration_ms,
                         total_tokens_input, total_tokens_output,
                         total_tokens_reasoning, total_tokens_cache,
                         total_cost, model_id, provider_id, agent_name,
                         message_count, agent_type, synced_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        sess.session_id, sess.project_id, sess.parent_id,
                        sess.slug, sess.title,
                        sess.summary_additions, sess.summary_deletions,
                        sess.summary_files,
                        sess.time_created, sess.time_updated, sess.duration_ms,
                        sess.total_tokens_input, sess.total_tokens_output,
                        sess.total_tokens_reasoning, sess.total_tokens_cache_read,
                        sess.total_cost, sess.model_id, sess.provider_id,
                        sess.agent_name, sess.message_count,
                        agent_type, now_ts,
                    ))

                # 2. 同步 Agent 层级
                root_ids = set()
                cursor = conn.execute(
                    "SELECT DISTINCT session_id FROM session_snapshots "
                    "WHERE session_id IN "
                    "(SELECT session_id FROM session_snapshots "
                    "WHERE parent_id IS NULL OR parent_id = '' "
                    f"ORDER BY time_created DESC LIMIT 200)"
                )
                for row in cursor.fetchall():
                    root_ids.add(row["session_id"])

                for rid in root_ids:
                    hierarchy = reader.get_agent_hierarchy(rid)
                    self._sync_hierarchy(conn, hierarchy, rid, now_ts)

                # 3. 重新计算每日聚合
                self._recompute_daily_aggregates(conn)

                # 4. 重新计算模型统计
                self._recompute_model_usage(conn)

                # 5. 重新计算 Agent 类型统计
                self._recompute_agent_type_usage(conn, reader)

                conn.commit()
            finally:
                conn.close()

    def _sync_hierarchy(self, conn: sqlite3.Connection,
                         records: list, root_id: str,
                         synced_at: int):
        """递归同步 agent 层级记录"""
        from .opencode_db_reader import AgentSessionRecord
        for rec in records:
            conn.execute("""
                INSERT OR REPLACE INTO agent_hierarchy
                (session_id, parent_id, root_session_id, title,
                 agent_type, model_id, tokens_total, cost_total,
                 duration_ms, level, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec.session_id, rec.parent_id, root_id,
                rec.title, rec.agent_type, rec.model_id,
                rec.total_tokens_input + rec.total_tokens_output +
                rec.total_tokens_reasoning,
                rec.total_cost, rec.duration_ms,
                rec.level, synced_at,
            ))
            if rec.children:
                self._sync_hierarchy(conn, rec.children, root_id, synced_at)

    def _recompute_daily_aggregates(self, conn: sqlite3.Connection):
        """从 session_snapshots 重新计算每日聚合"""
        conn.execute("DELETE FROM daily_aggregates")
        conn.execute("""
            INSERT INTO daily_aggregates
            (date, sessions_total, sessions_main, sessions_sub,
             total_tokens_input, total_tokens_output,
             total_tokens_reasoning, total_tokens_cache,
             total_cost, total_duration_s,
             unique_models, unique_agents, files_changed,
             synced_at)
            SELECT
                DATE(time_created / 1000, 'unixepoch', 'localtime') as date,
                COUNT(*) as sessions_total,
                SUM(CASE WHEN parent_id IS NULL OR parent_id = ''
                    THEN 1 ELSE 0 END) as sessions_main,
                SUM(CASE WHEN parent_id IS NOT NULL AND parent_id != ''
                    THEN 1 ELSE 0 END) as sessions_sub,
                SUM(total_tokens_input) as total_tokens_input,
                SUM(total_tokens_output) as total_tokens_output,
                SUM(total_tokens_reasoning) as total_tokens_reasoning,
                SUM(total_tokens_cache) as total_tokens_cache,
                SUM(total_cost) as total_cost,
                SUM(duration_ms) / 1000.0 as total_duration_s,
                COUNT(DISTINCT model_id) as unique_models,
                COUNT(DISTINCT agent_type || agent_name) as unique_agents,
                SUM(summary_files) as files_changed,
                MAX(synced_at) as synced_at
            FROM session_snapshots
            GROUP BY date
        """)

    def _recompute_model_usage(self, conn: sqlite3.Connection):
        """从 session_snapshots 重新计算模型统计"""
        conn.execute("DELETE FROM model_usage")
        conn.execute("""
            INSERT INTO model_usage
            (model_id, date, sessions_count,
             total_tokens_input, total_tokens_output,
             total_tokens_reasoning, total_cost,
             total_duration_ms, synced_at)
            SELECT
                model_id,
                DATE(time_created / 1000, 'unixepoch', 'localtime') as date,
                COUNT(*) as sessions_count,
                SUM(total_tokens_input) as total_tokens_input,
                SUM(total_tokens_output) as total_tokens_output,
                SUM(total_tokens_reasoning) as total_tokens_reasoning,
                SUM(total_cost) as total_cost,
                SUM(duration_ms) as total_duration_ms,
                MAX(synced_at) as synced_at
            FROM session_snapshots
            WHERE model_id != ''
            GROUP BY model_id, date
        """)

    def _recompute_agent_type_usage(self, conn: sqlite3.Connection,
                                     reader: OpencodeDBReader):
        """从 session_snapshots 重新计算 Agent 类型统计"""
        conn.execute("DELETE FROM agent_type_usage")
        conn.execute("""
            INSERT INTO agent_type_usage
            (agent_type, date, sessions_count,
             total_tokens, total_cost,
             total_duration_ms, synced_at)
            SELECT
                agent_type,
                DATE(time_created / 1000, 'unixepoch', 'localtime') as date,
                COUNT(*) as sessions_count,
                SUM(total_tokens_input + total_tokens_output +
                    total_tokens_reasoning) as total_tokens,
                SUM(total_cost) as total_cost,
                SUM(duration_ms) as total_duration_ms,
                MAX(synced_at) as synced_at
            FROM session_snapshots
            WHERE agent_type != ''
            GROUP BY agent_type, date
        """)

    # ─── 查询方法 ──────────────────────────────

    def get_session_snapshots(self, days: int = 7,
                               limit: int = 200) -> List[dict]:
        """获取会话快照列表"""
        cutoff = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT * FROM session_snapshots
                    WHERE time_created >= ?
                    ORDER BY time_created DESC
                    LIMIT ?
                """, (cutoff, limit))
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    def get_agent_hierarchy(self, root_session_id: str) -> List[dict]:
        """获取 agent 层级树"""
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT * FROM agent_hierarchy
                    WHERE root_session_id = ?
                    ORDER BY level ASC, duration_ms DESC
                """, (root_session_id,))
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    def get_daily_aggregates(self, days: int = 30) -> List[dict]:
        """获取每日聚合统计"""
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT * FROM daily_aggregates
                    WHERE date >= ?
                    ORDER BY date DESC
                """, (cutoff,))
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    def get_model_usage(self, days: int = 30) -> List[dict]:
        """获取模型使用统计"""
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT
                        model_id,
                        SUM(sessions_count) as total_sessions,
                        SUM(total_tokens_input) as total_tokens_input,
                        SUM(total_tokens_output) as total_tokens_output,
                        SUM(total_tokens_reasoning) as total_tokens_reasoning,
                        SUM(total_cost) as total_cost,
                        SUM(total_duration_ms) as total_duration_ms
                    FROM model_usage
                    WHERE date >= ?
                    GROUP BY model_id
                    ORDER BY total_cost DESC
                """, (cutoff,))
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    def get_agent_type_usage(self, days: int = 30) -> List[dict]:
        """获取 Agent 类型使用统计"""
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT
                        agent_type,
                        SUM(sessions_count) as total_sessions,
                        SUM(total_tokens) as total_tokens,
                        SUM(total_cost) as total_cost,
                        SUM(total_duration_ms) as total_duration_ms
                    FROM agent_type_usage
                    WHERE date >= ?
                    GROUP BY agent_type
                    ORDER BY total_sessions DESC
                """, (cutoff,))
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    def get_summary(self, days: int = 7) -> dict:
        """获取总体摘要统计

        注意：days=1 时表示"今天"（当前日历日），
        days=7 时表示"本周/近7天"，以此类推。
        """
        if days == 1:
            # 当前日历日
            cutoff = datetime.now().strftime("%Y-%m-%d")
        else:
            cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT
                        COALESCE(SUM(sessions_total), 0) as total_sessions,
                        COALESCE(SUM(sessions_main), 0) as total_sessions_main,
                        COALESCE(SUM(sessions_sub), 0) as total_sessions_sub,
                        COALESCE(SUM(total_tokens_input), 0) as total_tokens_input,
                        COALESCE(SUM(total_tokens_output), 0) as total_tokens_output,
                        COALESCE(SUM(total_tokens_reasoning), 0) as total_tokens_reasoning,
                        COALESCE(SUM(total_cost), 0) as total_cost,
                        COALESCE(SUM(total_duration_s), 0) as total_duration_s,
                        COALESCE(SUM(files_changed), 0) as files_changed,
                        COALESCE(SUM(unique_models), 0) as unique_models
                    FROM daily_aggregates
                    WHERE date >= ?
                """, (cutoff,))
                row = cursor.fetchone()
                result = dict(row) if row else {}
                # 计算平均值
                total = result.get("total_sessions", 0) or 0
                if total > 0:
                    result["avg_tokens_per_session"] = (
                        (result.get("total_tokens_input", 0) or 0) +
                        (result.get("total_tokens_output", 0) or 0)
                    ) / total
                    result["avg_cost_per_session"] = (
                        result.get("total_cost", 0) or 0
                    ) / total
                else:
                    result["avg_tokens_per_session"] = 0
                    result["avg_cost_per_session"] = 0.0
                return result
            finally:
                conn.close()

    def get_recent_activity(self, limit: int = 50) -> List[dict]:
        """获取最近的会话活动（用于实时面板）"""
        with self._lock:
            conn = self._connect()
            try:
                cursor = conn.execute("""
                    SELECT session_id, project_id, parent_id, title,
                           time_created, time_updated, duration_ms,
                           total_cost, total_tokens_input + total_tokens_output
                               + total_tokens_reasoning as total_tokens,
                           model_id, agent_type
                    FROM session_snapshots
                    ORDER BY time_created DESC
                    LIMIT ?
                """, (limit,))
                return [dict(row) for row in cursor.fetchall()]
            finally:
                conn.close()

    # ─── 维护 ──────────────────────────────────

    def get_db_size(self) -> int:
        """获取数据库文件大小（字节）"""
        try:
            return os.path.getsize(self._db_path)
        except OSError:
            return 0

    def optimize(self):
        """优化数据库（VACUUM + 重建索引）"""
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("VACUUM")
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                conn.commit()
            finally:
                conn.close()

    def cleanup_old_data(self, days: int = 90):
        """清理超过指定天数的旧数据

        Args:
            days: 保留的天数（默认 90 天）
        """
        cutoff_ts = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    "DELETE FROM session_snapshots WHERE time_created < ?",
                    (cutoff_ts,)
                )
                conn.execute(
                    "DELETE FROM agent_hierarchy WHERE synced_at < ?",
                    (cutoff_ts,)
                )
                conn.execute(
                    "DELETE FROM daily_aggregates WHERE date < ?",
                    (cutoff_date,)
                )
                conn.execute(
                    "DELETE FROM model_usage WHERE date < ?",
                    (cutoff_date,)
                )
                conn.execute(
                    "DELETE FROM agent_type_usage WHERE date < ?",
                    (cutoff_date,)
                )
                conn.commit()
            finally:
                conn.close()

    def clear_all(self):
        """清空所有监控数据（用于手动重置）"""
        with self._lock:
            conn = self._connect()
            try:
                tables = [
                    "real_time_agents", "session_snapshots",
                    "agent_hierarchy", "daily_aggregates",
                    "model_usage", "agent_type_usage",
                ]
                for t in tables:
                    conn.execute(f"DELETE FROM {t}")
                conn.commit()
            finally:
                conn.close()
