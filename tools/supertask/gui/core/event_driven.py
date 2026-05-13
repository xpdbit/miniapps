# -*- coding: utf-8 -*-
"""
event_driven.py — 事件驱动集成（Webhook + Cron 调度）
为 SuperTask 增加外部事件触发和定时调度能力。

组件:
  WebhookServer  — 内嵌轻量 HTTP server 监听 GitHub/自定义 webhook
  CronScheduler  — 基于 cron 表达式的定时任务调度器
"""

import hashlib
import hmac
import json
import os
import threading
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Callable, Optional


# ─── WebhookServer ────────────────────────────

class WebhookHandler(BaseHTTPRequestHandler):
    """GitHub-style webhook HTTP handler"""

    # 类变量：由外部设置的回调
    on_push: Optional[Callable[[dict], None]] = None
    on_issue: Optional[Callable[[dict], None]] = None
    secret: str = ""

    def do_POST(self):
        """处理 POST webhook 请求"""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""

        # 验证签名（如果配置了 secret）
        if self.secret:
            signature = self.headers.get("X-Hub-Signature-256", "")
            if not self._verify_signature(body, signature):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Invalid signature")
                return

        # 解析事件类型
        event_type = self.headers.get("X-GitHub-Event", "ping")

        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {}

        # 分发事件
        if event_type == "push" and self.on_push:
            self.on_push(payload)
        elif event_type == "issues" and self.on_issue:
            self.on_issue(payload)

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def do_GET(self):
        """健康检查端点"""
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"healthy","service":"supertask-webhook"}')

    def log_message(self, format, *args):
        """抑制 HTTP server 默认日志"""
        pass

    def _verify_signature(self, body: bytes, signature: str) -> bool:
        """验证 HMAC-SHA256 签名"""
        if not signature.startswith("sha256="):
            return False
        expected = hmac.new(
            self.secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)


class WebhookServer:
    """内嵌 HTTP webhook 服务器（后台线程）"""

    def __init__(self, port: int = 9090, secret: str = ""):
        self.port = port
        self.secret = secret
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._log_callback: Optional[Callable[[str, str], None]] = None

    def set_log_callback(self, callback: Callable[[str, str], None]):
        """设置日志回调（用于接入 SuperTask 日志系统）"""
        self._log_callback = callback

    def set_handlers(self, on_push=None, on_issue=None):
        """设置事件处理器"""
        if on_push is not None:
            WebhookHandler.on_push = on_push  # type: ignore[assignment]
        if on_issue is not None:
            WebhookHandler.on_issue = on_issue  # type: ignore[assignment]
        WebhookHandler.secret = self.secret

    def start(self):
        """启动 webhook 服务器（后台线程）"""
        if self._running:
            return

        self._log("info", f"Webhook 服务器启动: port={self.port}")

        def _run():
            self._server = HTTPServer(("127.0.0.1", self.port), WebhookHandler)
            self._server.timeout = 1
            self._running = True
            while self._running:
                self._server.handle_request()

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()

    def stop(self):
        """停止 webhook 服务器"""
        self._running = False
        if self._server:
            try:
                self._server.shutdown()
            except Exception:
                pass
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        self._log("info", "Webhook 服务器已停止")

    def _log(self, level: str, message: str):
        if self._log_callback:
            self._log_callback(level, f"[Webhook] {message}")


# ─── CronScheduler ────────────────────────────

class CronScheduler:
    """基于 cron 表达式的轻量级任务调度器（后台线程）"""

    def __init__(self):
        self._jobs: list[dict] = []
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._lock = threading.Lock()
        self._log_callback: Optional[Callable[[str, str], None]] = None

    def set_log_callback(self, callback: Callable[[str, str], None]):
        self._log_callback = callback

    def add_job(self, cron_expr: str, action: str, project: str = "all"):
        """添加定时任务

        Args:
            cron_expr: cron 表达式 "分 时 日 月 周" (简化版)
            action: 触发动作 "explore" | "execute" | "auto_cycle" | "verify"
            project: 目标项目名或 "all"
        """
        with self._lock:
            self._jobs.append({
                "cron": cron_expr,
                "action": action,
                "project": project,
                "last_run": 0.0,
            })

    def set_on_trigger(self, callback: Callable[[str, str], None]):
        """设置触发回调: callback(action, project)"""
        self._on_trigger = callback

    def start(self):
        """启动调度器（后台线程，每分钟检查一次）"""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        self._log("info", f"Cron 调度器启动: {len(self._jobs)} 个定时任务")

    def stop(self):
        """停止调度器"""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        self._log("info", "Cron 调度器已停止")

    def _loop(self):
        """调度循环 — 每分钟检查一次"""
        while self._running:
            now = time.time()
            current = datetime.now()

            with self._lock:
                for job in self._jobs:
                    if self._cron_matches(job["cron"], current):
                        # 避免同一分钟内重复触发
                        if now - job["last_run"] > 59:
                            job["last_run"] = now
                            self._log(
                                "decision",
                                f"Cron 触发: {job['action']} [{job['project']}]",
                            )
                            if hasattr(self, '_on_trigger'):
                                self._on_trigger(job["action"], job["project"])

            time.sleep(60)  # 每分钟检查一次

    @staticmethod
    def _cron_matches(expr: str, dt: datetime) -> bool:
        """检查 cron 表达式是否匹配当前时间（简化版，支持 5 字段）"""
        try:
            parts = expr.strip().split()
            if len(parts) != 5:
                return False
            minute, hour, day, month, weekday = parts

            targets = [
                (minute, dt.minute),
                (hour, dt.hour),
                (day, dt.day),
                (month, dt.month),
                (weekday, dt.weekday()),  # 0=Mon, 6=Sun
            ]

            for expr_val, actual in targets:
                if not CronScheduler._field_matches(expr_val, actual):
                    return False
            return True
        except (ValueError, IndexError):
            return False

    @staticmethod
    def _field_matches(expr: str, value: int) -> bool:
        """检查单个 cron 字段是否匹配"""
        if expr == "*":
            return True
        # 逗号分隔: "1,3,5"
        if "," in expr:
            return any(
                CronScheduler._field_matches(p.strip(), value)
                for p in expr.split(",")
            )
        # 范围: "1-5"
        if "-" in expr:
            lo, hi = expr.split("-", 1)
            return int(lo) <= value <= int(hi)
        # 步进: "*/5"
        if expr.startswith("*/"):
            step = int(expr[2:])
            return value % step == 0
        # 精确值
        return int(expr) == value

    def _log(self, level: str, message: str):
        if self._log_callback:
            self._log_callback(level, f"[Cron] {message}")


# ─── 工厂函数 ─────────────────────────────────

def create_event_system(
    webhook_config: dict,
    log_callback: Callable[[str, str], None],
    on_webhook_trigger: Callable[[str, str], None],
) -> tuple[Optional[WebhookServer], CronScheduler]:
    """创建事件系统（webhook + cron）。

    Args:
        webhook_config: 来自 config.yaml 的 webhook 配置节
        log_callback: 日志回调 (level, message)
        on_webhook_trigger: webhook/cron 触发回调 (action, project)

    Returns:
        (webhook_server_or_none, cron_scheduler)
    """
    scheduler = CronScheduler()
    scheduler.set_log_callback(log_callback)
    scheduler.set_on_trigger(on_webhook_trigger)

    # Webhook（仅当启用时创建）
    webhook = None
    if webhook_config.get("enabled", False):
        webhook = WebhookServer(
            port=webhook_config.get("port", 9090),
            secret=webhook_config.get("secret", ""),
        )
        webhook.set_log_callback(log_callback)
        webhook.set_handlers(
            on_push=lambda payload: on_webhook_trigger("explore", "all"),
            on_issue=lambda payload: on_webhook_trigger("explore", "all"),
        )

    # Cron jobs
    for job_cfg in webhook_config.get("cron", {}).get("jobs", []):
        if isinstance(job_cfg, dict):
            scheduler.add_job(
                cron_expr=job_cfg.get("schedule", "0 2 * * *"),
                action=job_cfg.get("action", "auto_cycle"),
                project=job_cfg.get("project", "all"),
            )

    return webhook, scheduler
