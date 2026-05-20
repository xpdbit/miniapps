"""适配器：封装 SuperTask 的 opencode_db_reader.py。

隔离对 SuperTask 的强依赖，异常安全，为 DataStore 提供统一数据接口。
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


class OcpDBAdapter:
    """opencode 数据库读取适配器。异常安全，失败时返回空结构。"""

    SUPER_TASK_MODULE = "opencode_db_reader"
    SUPER_TASK_PATH = Path(__file__).parent.parent.parent / "supertask" / "gui" / "core"

    def __init__(self, db_path: Optional[str] = None):
        self._reader = None
        self._db_path = db_path
        self._available = False
        self._init_reader()

    def _init_reader(self) -> None:
        """延迟初始化 OpencodeDBReader。"""
        try:
            module_dir = str(self.SUPER_TASK_PATH.resolve())
            if module_dir not in sys.path:
                sys.path.insert(0, module_dir)
            from opencode_db_reader import OpencodeDBReader  # type: ignore
            self._reader = OpencodeDBReader(db_path=self._db_path)
            self._available = True
        except ImportError:
            self._available = False
        except Exception:
            self._available = False

    # ── 可用性 ──

    def is_available(self) -> bool:
        return self._available and self._reader is not None and self._reader.is_available()

    def _get_reader(self):
        """安全获取 reader 引用（避免 LSP None 类型警告）。"""
        if not self._available or self._reader is None:
            return None
        return self._reader

    # ── 会话列表 ──

    def list_sessions(self, days: int = 1) -> list[dict]:
        reader = self._get_reader()
        if not reader:
            return []
        try:
            records = reader.list_sessions(days=days, limit=200)
            return [_session_to_dict(r) for r in records]
        except Exception:
            return []

    # ── 汇总统计 ──

    def get_summary_stats(self, days: int = 1) -> dict:
        reader = self._get_reader()
        if not reader:
            return {}
        try:
            s = reader.get_summary_stats(days=days)
            return {
                "total_sessions": s.total_sessions,
                "total_sessions_main": s.total_sessions_main,
                "total_sessions_sub": s.total_sessions_sub,
                "total_tokens_input": s.total_tokens_input,
                "total_tokens_output": s.total_tokens_output,
                "total_tokens_reasoning": s.total_tokens_reasoning,
                "total_cost": s.total_cost,
                "total_duration_s": s.total_duration_s,
                "total_files_changed": s.total_files_changed,
                "unique_models": s.unique_models,
                "unique_agent_types": s.unique_agent_types,
            }
        except Exception:
            return {}

    # ── Agent 类型统计 ──

    def get_agent_type_stats(self, days: int = 1) -> list[dict]:
        reader = self._get_reader()
        if not reader:
            return []
        try:
            return reader.get_agent_type_stats(days=days)
        except Exception:
            return []

    # ── 每日统计 ──

    def get_daily_stats(self, days: int = 7) -> list[dict]:
        reader = self._get_reader()
        if not reader:
            return []
        try:
            records = reader.get_daily_stats(days=days)
            return [_daily_to_dict(r) for r in records]
        except Exception:
            return []

    # ── API 历史（分页 + 搜索，基于 list_sessions 实现） ──

    def get_api_history(self, days: int = 7, search: str = "",
                        agent_type: str = "", page: int = 1,
                        page_size: int = 50) -> dict:
        reader = self._get_reader()
        if not reader:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

        try:
            records = reader.list_sessions(days=days, limit=5000)
            items = []
            for r in records:
                d = _session_to_dict(r)
                if search and search.lower() not in d.get("title", "").lower() \
                        and search.lower() not in d.get("session_id", "").lower() \
                        and search.lower() not in d.get("model_id", "").lower():
                    continue
                if agent_type and agent_type != "全部" \
                        and agent_type.lower() not in d.get("agent_name", "").lower():
                    continue
                items.append(d)

            total = len(items)
            start = (page - 1) * page_size
            end = start + page_size
            return {
                "items": items[start:end],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
        except Exception:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}


# ── 转换辅助 ──

def _session_to_dict(r) -> dict:
    """将 SessionRecord 转为普通 dict。"""
    return {
        "session_id": r.session_id,
        "project_id": r.project_id,
        "parent_id": r.parent_id,
        "slug": r.slug,
        "title": r.title,
        "summary_additions": r.summary_additions,
        "summary_deletions": r.summary_deletions,
        "summary_files": r.summary_files,
        "time_created": r.time_created,
        "time_updated": r.time_updated,
        "time_compacting": r.time_compacting,
        "duration_ms": r.duration_ms,
        "total_tokens_input": r.total_tokens_input,
        "total_tokens_output": r.total_tokens_output,
        "total_tokens_reasoning": r.total_tokens_reasoning,
        "total_tokens_cache_read": r.total_tokens_cache_read,
        "total_tokens_cache_write": r.total_tokens_cache_write,
        "total_cost": r.total_cost,
        "model_id": r.model_id,
        "provider_id": r.provider_id,
        "agent_name": r.agent_name,
        "message_count": r.message_count,
        "is_subagent": r.is_subagent,
        "total_tokens": r.total_tokens,
    }


def _daily_to_dict(d) -> dict:
    """将 DailyStats 转为普通 dict。"""
    return {
        "date": d.date,
        "sessions_total": d.sessions_total,
        "sessions_main": d.sessions_main,
        "sessions_sub": d.sessions_sub,
        "total_tokens_input": d.total_tokens_input,
        "total_tokens_output": d.total_tokens_output,
        "total_tokens_reasoning": d.total_tokens_reasoning,
        "total_tokens_cache": d.total_tokens_cache,
        "total_cost": d.total_cost,
        "total_duration_s": d.total_duration_s,
        "unique_models": d.unique_models,
        "unique_agents": d.unique_agents,
        "files_changed": d.files_changed,
    }
