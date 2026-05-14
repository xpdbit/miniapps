# -*- coding: utf-8 -*-
"""
schema.py — 状态文件 Pydantic 数据模型
为 proposed_tasks.yaml / approved_queue.yaml / config.yaml / history.yaml 定义结构，
FileManager 读写时自动校验，防止损坏数据静默丢失。
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


# ─── 枚举 ──────────────────────────────────────

class TaskStatus(str, Enum):
    PROPOSED = "proposed"
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"
    FAILED_BLOCKED = "failed_blocked"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    FIX_P0 = "fix P0"
    FIX_P1 = "fix P1"
    FIX_P2 = "fix P2"
    FIX_P3 = "fix P3"
    IDEA = "idea"
    HIGH = "high"


class HistoryResolution(str, Enum):
    DONE = "done"
    ERROR = "error"
    FAILED_BLOCKED = "failed_blocked"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


# ─── 任务模型 ──────────────────────────────────

class Task(BaseModel):
    """proposed_tasks.yaml / approved_queue.yaml 中的单个任务"""
    id: int = Field(description="任务唯一 ID")
    description: str = Field(min_length=1, max_length=2000, description="任务描述")
    priority: TaskPriority = Field(default=TaskPriority.FIX_P3, description="优先级")
    status: str = Field(default="proposed", description="任务状态")

    # 可选时间戳
    proposed_at: Optional[str] = Field(default=None, description="提议时间 (ISO 格式)")
    queued_at: Optional[str] = Field(default=None, description="入队时间")
    started_at: Optional[str] = Field(default=None, description="开始执行时间")
    completed_at: Optional[str] = Field(default=None, description="完成时间")

    # 失败相关
    fail_count: int = Field(default=0, ge=0, description="连续失败次数")
    error: Optional[str] = Field(default=None, max_length=2000, description="错误信息")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"proposed", "pending", "running", "done", "error", "failed_blocked", "cancelled"}
        if v not in allowed:
            raise ValueError(f"无效状态 '{v}'，允许: {allowed}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = {"fix P0", "fix P1", "fix P2", "fix P3", "idea", "high"}
        if v not in allowed:
            raise ValueError(f"无效优先级 '{v}'，允许: {allowed}")
        return v

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: int) -> int:
        if v < 1:
            raise ValueError(f"id 必须为正整数，当前: {v}")
        return v

    model_config = {
        "extra": "allow",  # 允许未定义字段（向后兼容）
        "str_strip_whitespace": True,
    }


class HistoryRecord(Task):
    """history.yaml 中的历史记录 — 在 Task 基础上增加 resolution"""
    resolution: str = Field(description="处理结果")
    resolved_at: Optional[str] = Field(default=None, description="处理时间")
    deleted_at: Optional[str] = Field(default=None, description="删除时间")

    @field_validator("resolution")
    @classmethod
    def validate_resolution(cls, v: str) -> str:
        allowed = {"done", "error", "failed_blocked", "cancelled", "rejected"}
        if v not in allowed:
            raise ValueError(f"无效 resolution '{v}'，允许: {allowed}")
        return v


# ─── 项目配置模型 ──────────────────────────────

class ProjectConfig(BaseModel):
    """config.yaml 中的单个项目定义"""
    name: str = Field(min_length=1, max_length=100, description="项目标识名")
    label: str = Field(default="", max_length=200, description="项目显示名称")
    source_dirs: list[str] = Field(default_factory=list, description="源码目录列表")

    @model_validator(mode="after")
    def set_default_label(self):
        if not self.label:
            self.label = self.name
        return self


class PromptConfig(BaseModel):
    """config.yaml 中的提示词配置"""
    dir: str = Field(default="prompts", description="提示词模板目录（相对于 state_dir）")


class UIConfig(BaseModel):
    """config.yaml 中的 UI 配置"""
    theme: str = Field(default="dark", pattern="^(dark|light)$")


class AgentConfig(BaseModel):
    """config.yaml 中的 Agent 配置"""
    timeout: int = Field(default=1200, ge=60, le=7200, description="超时时间（秒）")
    model: str = Field(default="", description="默认 AI 模型名（未指定分阶段模型时的回退）")
    model_explore: str = Field(default="", description="探索/提议阶段使用的 AI 模型")
    model_execute: str = Field(default="", description="执行任务阶段使用的 AI 模型")
    model_verify: str = Field(default="", description="检查验证阶段使用的 AI 模型")
    model_push: str = Field(default="", description="推送/收尾阶段使用的 AI 模型")
    model_evaluate: str = Field(default="", description="二次评估阶段使用的 AI 模型")


class BehaviorConfig(BaseModel):
    """config.yaml 中的行为配置"""
    auto_push: bool = Field(default=False)
    cycle_interval: int = Field(default=5, ge=1, le=3600, description="轮次间隔（秒）")
    max_retries: int = Field(default=2, ge=0, le=10, description="最大重试次数")
    max_tokens_per_cycle: int = Field(default=0, ge=0, description="每轮 Token 上限（0=不限制）")


class AppConfig(BaseModel):
    """config.yaml 完整配置模型"""
    prompts: PromptConfig = Field(default_factory=PromptConfig)
    ui: UIConfig = Field(default_factory=UIConfig)
    agent: AgentConfig = Field(default_factory=AgentConfig)
    behavior: BehaviorConfig = Field(default_factory=BehaviorConfig)
    projects: list[ProjectConfig] = Field(default_factory=list)

    model_config = {"extra": "allow", "str_strip_whitespace": True}


# ─── 校验工具函数 ──────────────────────────────

def validate_task_list(data: list, source: str = "unknown") -> tuple[list[Task], list[str]]:
    """批量校验任务列表，返回 (有效任务列表, 错误信息列表)。

    Args:
        data: 原始数据列表（来自 YAML 解析）
        source: 数据来源标识（用于错误消息）

    Returns:
        (valid_tasks, errors) — 有效任务和校验错误分开返回，不丢失任何数据
    """
    valid: list[Task] = []
    errors: list[str] = []

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            errors.append(f"[{source}] 第 {i + 1} 项不是字典: {type(item).__name__}")
            continue
        try:
            task = Task(**item)
            valid.append(task)
        except Exception as e:
            errors.append(f"[{source}] 第 {i + 1} 项 (id={item.get('id', '?')}) 校验失败: {e}")

    return valid, errors


def validate_history_list(data: list, source: str = "unknown") -> tuple[list[HistoryRecord], list[str]]:
    """批量校验历史记录列表"""
    valid: list[HistoryRecord] = []
    errors: list[str] = []

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            errors.append(f"[{source}] 第 {i + 1} 项不是字典: {type(item).__name__}")
            continue
        try:
            record = HistoryRecord(**item)
            valid.append(record)
        except Exception as e:
            errors.append(f"[{source}] 第 {i + 1} 项 (id={item.get('id', '?')}) 校验失败: {e}")

    return valid, errors


def validate_config(data: dict, source: str = "config.yaml") -> tuple[Optional[AppConfig], list[str]]:
    """校验配置文件，返回 (有效配置, 错误列表)"""
    errors: list[str] = []
    try:
        config = AppConfig(**data)
        return config, errors
    except Exception as e:
        errors.append(f"[{source}] 配置校验失败: {e}")
        return None, errors
