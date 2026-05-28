# -*- coding: utf-8 -*-
"""
localdev_manager.py — 本地服务生命周期管理

封装 localdev 的所有操作：基础设施 (MySQL/Redis) 启停、
项目服务启停、端口检测、服务配置读写。
所有服务定义由 .oce/quicklaunch.json 配置文件驱动，
修改配置即可灵活扩展启动项，无需修改 Python 代码。

供 QuickLaunchInterface 调用。
"""
from __future__ import annotations

import base64
import datetime
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable, Optional

from PyQt6.QtCore import QObject, pyqtSignal, QTimer
from .logger import OceLogger

# ── Windows: 防止 subprocess 弹出 CLI 窗口 ──
_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


# ── 内置默认配置（配置文件缺失时的回退） ──

_DEFAULT_INFRA: list[dict[str, Any]] = [
    {"name": "MySQL", "type": "docker", "container": "local-mysql", "port": 3307,
     "compose_file": "local_server/docker-compose.yml"},
    {"name": "Redis", "type": "docker", "container": "local-redis", "port": 6379,
     "compose_file": "local_server/docker-compose.yml"},
]

_DEFAULT_SERVICES: list[dict[str, Any]] = [
    {"name": "FTG Server",       "type": "npm", "dir": "apps/ftg/server",
     "command": "npm run dev",       "port": 3000, "build": "npm run build"},
    {"name": "Game1 Server",     "type": "npm", "dir": "apps/game1/server",
     "command": "npm run dev",       "port": 3004, "build": "npm run build"},
    {"name": "Tavern Server",    "type": "npm", "dir": "apps/tavern/server",
     "command": "npm run dev",       "port": 3002, "build": "npm run build"},
    {"name": "Dashboard Admin",  "type": "npm", "dir": "dashboard",
     "command": "npm run dev:admin", "port": 3001, "build": "npm run build"},
    {"name": "Dashboard Front",  "type": "npm", "dir": "dashboard",
     "command": "npm run dev",       "port": 5173, "build": "npm run build"},
    {"name": "Tavern H5 Web",    "type": "npm", "dir": "apps/tavern/client",
     "command": "npm run dev:web",   "port": 5174, "build": "npm run build:web"},
]


# ── 配置加载 ──


def _find_project_root() -> Optional[Path]:
    """查找项目根目录（包含 local_server/ 或 .oce/ 的上级）。"""
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / "local_server").is_dir() or (parent / ".oce").is_dir():
            return parent
    return None


def _get_quicklaunch_path() -> Optional[Path]:
    """获取 .oce/quicklaunch.json 路径。"""
    root = _find_project_root()
    if root:
        return root / ".oce" / "quicklaunch.json"
    return None


def _load_quicklaunch_config() -> dict[str, Any]:
    """加载 quicklaunch.json 配置。

    返回结构化配置，字段缺失时填充默认值。
    """
    cfg_path = _get_quicklaunch_path()
    config: dict[str, Any] = {}

    if cfg_path and cfg_path.exists():
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                config = raw
        except (json.JSONDecodeError, OSError):
            pass

    # 合并默认值（配置缺失的字段用默认值填充）
    infra = config.get("infra")
    if not infra or not isinstance(infra, list):
        infra = _DEFAULT_INFRA
    config["infra"] = infra

    services = config.get("services")
    if not services or not isinstance(services, list):
        services = _DEFAULT_SERVICES
    config["services"] = services

    enabled = config.get("enabled")
    if not enabled or not isinstance(enabled, list):
        enabled = [s["name"] for s in services]
    config["enabled"] = enabled

    return config


def get_infra_services() -> list[dict[str, Any]]:
    """返回基础设施服务列表。"""
    return list(_load_quicklaunch_config().get("infra", _DEFAULT_INFRA))


def get_server_services() -> list[dict[str, Any]]:
    """返回项目服务列表（与 local_server/dev_console.py 保持同步）。"""
    return list(_load_quicklaunch_config().get("services", _DEFAULT_SERVICES))


def load_enabled_names() -> list[str]:
    """读取启用的服务名称列表。

    优先从 quicklaunch.json 读取，兼容原有 service_config.json。
    均缺失时默认全部启用。
    """
    # 优先 quicklaunch.json 中的 enabled
    cfg = _load_quicklaunch_config()
    enabled = cfg.get("enabled")
    if enabled and isinstance(enabled, list) and len(enabled) > 0:
        return list(enabled)

    # 回退 service_config.json（兼容 localdev 旧配置）
    svc_cfg = _get_service_config_path()
    if svc_cfg and svc_cfg.exists():
        try:
            with open(svc_cfg, "r", encoding="utf-8") as f:
                data = json.load(f)
                names = data.get("enabled", [])
                if names and isinstance(names, list):
                    return names
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    return [s["name"] for s in cfg.get("services", _DEFAULT_SERVICES)]


def save_enabled_names(enabled: list[str]) -> bool:
    """保存启用的服务名称列表到 quicklaunch.json。"""
    cfg_path = _get_quicklaunch_path()
    if not cfg_path:
        return False

    try:
        # 读取现有配置，只更新 enabled 字段
        existing = {}
        if cfg_path.exists():
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except (json.JSONDecodeError, OSError):
                pass

        existing["enabled"] = enabled
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        return True
    except OSError:
        return False


def _get_service_config_path() -> Optional[Path]:
    """获取 service_config.json 路径（兼容旧版 localdev）。"""
    root = _find_project_root()
    if root:
        return root / "local_server" / "service_config.json"
    return None


def _get_compose_file(infra_svc: Optional[dict] = None) -> Optional[Path]:
    """获取 docker-compose.yml 路径。

    优先使用配置中指定的 compose_file 路径，回退默认位置。
    """
    if infra_svc and infra_svc.get("compose_file"):
        root = _find_project_root()
        if root:
            candidate = root / infra_svc["compose_file"]
            if candidate.exists():
                return candidate
    root = _find_project_root()
    if root:
        return root / "local_server" / "docker-compose.yml"
    return None


def _get_env_file() -> Optional[Path]:
    root = _find_project_root()
    if root:
        return root / "local_server" / ".env"
    return None


def _get_log_base() -> Optional[Path]:
    root = _find_project_root()
    if root:
        return root / "local_server" / "logs"
    return None


# ── 端口 & 容器检测 ──


def _parse_netstat() -> dict[int, set[int]]:
    """解析 netstat -ano 输出，返回 {port: {pid, ...}}。"""
    port_map: dict[int, set[int]] = {}
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=10,
            creationflags=_NO_WINDOW,
        )
        for line in result.stdout.splitlines():
            match = re.search(r":(\d+)\s+\S+\s+LISTENING\s+(\d+)", line)
            if match:
                port = int(match.group(1))
                pid = int(match.group(2))
                port_map.setdefault(port, set()).add(pid)
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        pass
    return port_map


def _check_docker_container(container_name: str) -> bool:
    """检查 Docker 容器是否正在运行。"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", f"name={container_name}",
             "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=10,
            creationflags=_NO_WINDOW,
        )
        return container_name in result.stdout.strip().splitlines()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


# ── 状态刷新工作线程 ──


class _StatusRefresher(QObject):
    """后台线程执行 netstat/docker 检测，通过信号回传结果到主线程。

    避免 subprocess.run() 阻塞 Qt 事件循环导致 UI 卡顿。
    """

    finished = pyqtSignal(dict, dict)  # (infra_status, service_status)

    def __init__(self, manager: LocalDevManager):
        super().__init__()
        self._manager = manager

    def run(self) -> None:
        """在线程中执行阻塞 I/O，完成后 emit 信号。"""
        port_map = _parse_netstat()

        infra_status: dict[str, bool] = {}
        for svc in self._manager.infra_services:
            container = svc.get("container", "")
            infra_status[svc["name"]] = _check_docker_container(container) if container else False

        service_status: dict[str, bool] = {}
        for svc in self._manager.server_services:
            pids = port_map.get(svc["port"], set())
            service_status[svc["name"]] = len(pids) > 0

        self.finished.emit(infra_status, service_status)


# ── Manager 单例 ──


class LocalDevManager:
    """本地开发服务管理单例。

    管理基础设施 (MySQL/Redis) 和项目服务的生命周期，
    通过 subscribe 机制通知 UI 更新。
    服务定义由 .oce/quicklaunch.json 驱动。
    """

    _instance: Optional[LocalDevManager] = None

    def __init__(self):
        self._logger = OceLogger.get_instance()
        self._callbacks: list[Callable] = []
        self._project_root = _find_project_root()

        # 缓存状态
        self._infra_status: dict[str, bool] = {}
        self._service_status: dict[str, bool] = {}
        self._last_refresh: float = 0

        # 缓存配置
        self._config: dict[str, Any] = {}
        self._reload_config()

        self._logger.info(f"LocalDevManager 初始化，项目根目录: {self._project_root}")

    @classmethod
    def get_instance(cls) -> LocalDevManager:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _reload_config(self) -> None:
        """重新加载 quicklaunch.json 配置。"""
        self._config = _load_quicklaunch_config()

    # ── 属性 ──

    @property
    def project_root(self) -> Optional[Path]:
        return self._project_root

    @property
    def config_path(self) -> Optional[Path]:
        """配置文件路径（供 UI 显示/编辑用）。"""
        return _get_quicklaunch_path()

    @property
    def infra_services(self) -> list[dict[str, Any]]:
        return list(self._config.get("infra", _DEFAULT_INFRA))

    @property
    def server_services(self) -> list[dict[str, Any]]:
        return list(self._config.get("services", _DEFAULT_SERVICES))

    @property
    def infra_status(self) -> dict[str, bool]:
        return dict(self._infra_status)

    @property
    def service_status(self) -> dict[str, bool]:
        return dict(self._service_status)

    @property
    def enabled_names(self) -> list[str]:
        """返回当前启用的服务名称列表。"""
        return list(self._config.get("enabled", []))

    @property
    def enabled_services(self) -> list[dict[str, Any]]:
        """返回已启用的服务列表。"""
        enabled_names = set(self.enabled_names)
        return [s for s in self.server_services if s["name"] in enabled_names]

    # ── 订阅 ──

    def subscribe(self, callback: Callable) -> None:
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    def unsubscribe(self, callback: Callable) -> None:
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    def _notify(self) -> None:
        for cb in self._callbacks:
            try:
                cb()
            except Exception as e:
                self._logger.error(f"LocalDevManager 通知回调失败: {e}")

    # ── 状态刷新 ──

    def refresh_status(self) -> None:
        """异步刷新所有服务状态（后台线程执行 netstat/docker 检测）。

        阻塞的 subprocess 调用移至后台线程，避免冻结 Qt 事件循环。
        完成后通过 _on_status_refreshed 回调更新缓存并通知 UI。
        """
        # 防止并发刷新（上一次未完成时不重复启动）
        if getattr(self, "_refresh_pending", False):
            return
        self._refresh_pending = True

        refresher = _StatusRefresher(self)
        refresher.finished.connect(self._on_status_refreshed)
        # 保持引用防止被 GC
        self._active_refresher = refresher
        thread = threading.Thread(target=refresher.run, daemon=True)
        thread.start()

    def _on_status_refreshed(self, infra_status: dict[str, bool],
                             service_status: dict[str, bool]) -> None:
        """后台刷新完成回调（主线程执行）。"""
        self._refresh_pending = False
        old_infra = dict(self._infra_status)
        old_svc = dict(self._service_status)
        self._infra_status = infra_status
        self._service_status = service_status
        self._last_refresh = time.time()

        # 状态变化时通知
        if self._infra_status != old_infra or self._service_status != old_svc:
            self._notify()

    # ── 基础设施操作 ──

    def start_infra(self) -> bool:
        """启动基础设施 (MySQL + Redis)。返回是否成功。"""
        compose = _get_compose_file()
        if not compose:
            self._logger.error("未找到 docker-compose.yml")
            return False

        self._logger.info("正在启动基础设施 (MySQL + Redis)...")
        try:
            env_file = _get_env_file()
            cmd = ["docker", "compose", "-f", str(compose)]
            if env_file and env_file.exists():
                cmd.extend(["--env-file", str(env_file)])
            cmd.extend(["up", "-d"])

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60,
                                    creationflags=_NO_WINDOW)
            if result.returncode != 0:
                self._logger.error(f"Docker 启动失败: {result.stderr.strip()}")
                return False

            time.sleep(5)
            self.refresh_status()
            self._logger.info("基础设施已启动")
            return True
        except subprocess.TimeoutExpired:
            self._logger.error("Docker 启动超时")
            return False
        except FileNotFoundError:
            self._logger.error("未找到 Docker，请确认 Docker Desktop 已运行")
            return False
        except Exception as e:
            self._logger.error(f"启动基础设施失败: {e}")
            return False

    def stop_infra(self) -> bool:
        """停止基础设施。返回是否成功。"""
        compose = _get_compose_file()
        if not compose:
            return False

        self._logger.info("正在停止基础设施...")
        try:
            env_file = _get_env_file()
            cmd = ["docker", "compose", "-f", str(compose)]
            if env_file and env_file.exists():
                cmd.extend(["--env-file", str(env_file)])
            cmd.append("down")

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                                    creationflags=_NO_WINDOW)
            if result.returncode != 0:
                self._logger.warning(
                    f"Docker 停止可能未完全成功: {result.stderr.strip()}")

            self.refresh_status()
            self._logger.info("基础设施已停止")
            return True
        except Exception as e:
            self._logger.error(f"停止基础设施失败: {e}")
            return False

    def start_single_docker(self, container_name: str) -> bool:
        """启动单个 Docker 容器。

        根据容器名查找对应的 infra 配置，使用其指定的 compose_file。
        """
        # 查找容器对应的 infra 配置
        infra_svc = next(
            (svc for svc in self.infra_services
             if svc.get("container") == container_name),
            None,
        )
        compose = _get_compose_file(infra_svc)
        if not compose:
            self._logger.error(f"未找到 {container_name} 对应的 compose 文件")
            return False
        try:
            env_file = _get_env_file()
            cmd = ["docker", "compose", "-f", str(compose)]
            if env_file and env_file.exists():
                cmd.extend(["--env-file", str(env_file)])
            cmd.extend(["up", "-d", container_name])

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                                    creationflags=_NO_WINDOW)
            self.refresh_status()
            return result.returncode == 0
        except Exception as e:
            self._logger.error(f"启动容器 {container_name} 失败: {e}")
            return False

    def stop_single_docker(self, container_name: str) -> bool:
        """停止单个 Docker 容器。"""
        try:
            result = subprocess.run(
                ["docker", "stop", container_name],
                capture_output=True, text=True, timeout=15,
                creationflags=_NO_WINDOW,
            )
            self.refresh_status()
            return result.returncode == 0
        except Exception as e:
            self._logger.error(f"停止容器 {container_name} 失败: {e}")
            return False

    # ── 项目服务操作 ──

    def _find_service(self, svc_name: str) -> Optional[dict[str, Any]]:
        """按名称查找服务（基础设施 + 项目服务）。"""
        for svc in self.server_services:
            if svc["name"] == svc_name:
                return svc
        for svc in self.infra_services:
            if svc["name"] == svc_name:
                return svc
        return None

    def start_service(self, svc_name: str) -> bool:
        """启动单个项目服务（在 Windows Terminal 新标签页中）。"""
        svc = next((s for s in self.server_services if s["name"] == svc_name), None)
        if not svc or not self._project_root:
            return False

        workdir = self._project_root / svc["dir"]
        if not workdir.is_dir():
            self._logger.error(f"服务目录不存在: {workdir}")
            return False

        title = f"{svc['name']} ({svc['port']})"
        command = svc["command"]
        safe_name = svc["name"].replace(" ", "_")
        log_base = _get_log_base()
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H-%M-%S")

        log_dir = log_base / safe_name if log_base else None
        log_file = None
        if log_dir:
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / f"{timestamp}.log"

        runner_path = self._project_root / "local_server" / "log-runner.js"

        # 构造 PowerShell 命令（同 dev_console.py 方案）
        title_ps = title.replace("'", "''")
        workdir_ps = str(workdir).replace("'", "''")

        if log_file and runner_path.exists():
            log_file_ps = str(log_file).replace("'", "''")
            runner_ps = str(runner_path).replace("'", "''")
            ps_code = (
                f"$Host.UI.RawUI.WindowTitle = '{title_ps}'\n"
                f"Set-Location '{workdir_ps}'\n"
                f"$logFile = '{log_file_ps}'\n"
                f"$runner = '{runner_ps}'\n"
                f"$logDir = [System.IO.Path]::GetDirectoryName($logFile)\n"
                f"if (-not (Test-Path $logDir)) {{ "
                f"New-Item -ItemType Directory -Path $logDir -Force | Out-Null }}\n"
                f'Write-Host "[日志] $logFile" -ForegroundColor Cyan\n'
                f'node "$runner" "$logFile" {command}\n'
            )
        else:
            ps_code = (
                f"$Host.UI.RawUI.WindowTitle = '{title_ps}'\n"
                f"Set-Location '{workdir_ps}'\n"
                f"{command}\n"
            )

        ps_bytes = ps_code.encode("utf-16-le")
        encoded = base64.b64encode(ps_bytes).decode("ascii")

        try:
            subprocess.Popen([
                "wt", "--title", title, "-d", str(workdir),
                "powershell", "-NoExit", "-ExecutionPolicy", "Bypass",
                "-EncodedCommand", encoded,
            ])
            self._logger.info(f"已启动服务: {title}")
            # 状态由 UI 层定时轮询刷新，此处不启动线程
            return True
        except FileNotFoundError:
            self._logger.error("未找到 Windows Terminal (wt.exe)")
            try:
                subprocess.Popen(
                    command, cwd=str(workdir), shell=True,
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                )
                self._logger.info(f"已通过 fallback 启动: {title}")
                return True
            except Exception as e2:
                self._logger.error(f"fallback 启动失败: {e2}")
                return False
        except Exception as e:
            self._logger.error(f"启动服务失败: {e}")
            return False

    def stop_service(self, svc_name: str) -> bool:
        """停止占用某服务端口的进程。"""
        svc = next((s for s in self.server_services if s["name"] == svc_name), None)
        if not svc:
            return False

        port = svc["port"]
        port_map = _parse_netstat()
        pids = port_map.get(port, set())

        if not pids:
            self._logger.info(f"端口 {port} 无占用进程")
            self.refresh_status()
            return True

        killed = 0
        for pid in pids:
            try:
                code = subprocess.run(
                    ["taskkill", "/f", "/pid", str(pid)],
                    capture_output=True, text=True, timeout=10,
                    creationflags=_NO_WINDOW,
                ).returncode
                if code == 0:
                    killed += 1
            except Exception:
                pass

        self.refresh_status()
        if killed > 0:
            self._logger.info(f"已停止 {svc_name}: 杀死 {killed} 个进程")
        return killed > 0

    def restart_service(self, svc_name: str) -> bool:
        """重启服务：先停止再启动。"""
        self.stop_service(svc_name)
        time.sleep(1)
        return self.start_service(svc_name)

    # ── 批量操作 ──

    def start_all_services(self) -> None:
        """启动所有已启用的服务。"""
        for svc in self.enabled_services:
            self.start_service(svc["name"])
            time.sleep(0.5)

    def restart_all_services(self) -> None:
        """重启所有服务。

        仅杀死本项目已启用服务占用端口的进程，避免误杀系统其他 node.exe。
        """
        self.kill_port_processes()
        time.sleep(1)
        self.start_all_services()

    def kill_port_processes(self) -> int:
        """杀死所有已启用服务端口的进程。返回杀死的进程数。"""
        port_map = _parse_netstat()
        total = 0
        for svc in self.enabled_services:
            port = svc["port"]
            pids = port_map.get(port, set())
            for pid in pids:
                try:
                    code = subprocess.run(
                        ["taskkill", "/f", "/pid", str(pid)],
                        capture_output=True, text=True, timeout=10,
                    ).returncode
                    if code == 0:
                        total += 1
                except Exception:
                    pass
        self.refresh_status()
        return total

    def clean_logs(self) -> tuple[int, float]:
        """清理日志文件。返回 (删除文件数, 释放 MB)。

        递归删除 logs/ 下所有文件，然后清理空目录。
        """
        log_base = _get_log_base()
        if not log_base or not log_base.is_dir():
            return (0, 0)

        size = 0
        count = 0
        # 先删文件，再反向遍历删空目录
        dirs_to_try: list[str] = []
        for root, dirs, files in os.walk(log_base):
            dirs_to_try.append(root)
            for f in files:
                fp = os.path.join(root, f)
                try:
                    size += os.path.getsize(fp)
                    os.remove(fp)
                    count += 1
                except OSError:
                    pass

        # 从最深层开始尝试删除空目录
        for d in reversed(dirs_to_try):
            try:
                os.rmdir(d)
            except OSError:
                pass

        size_mb = size / (1024 * 1024)
        return (count, size_mb)

    def rebuild_service(self, svc_name: str) -> Optional[int]:
        """重新编译单个服务。返回 exit code 或 None（失败）。"""
        svc = next((s for s in self.server_services if s["name"] == svc_name), None)
        if not svc or not self._project_root:
            return None

        workdir = self._project_root / svc["dir"]
        if not workdir.is_dir():
            return None

        build_cmd = svc.get("build")
        if not build_cmd:
            return None

        try:
            result = subprocess.run(
                build_cmd, cwd=str(workdir), shell=True,
                capture_output=True, text=True, timeout=120,
                creationflags=_NO_WINDOW,
            )
            return result.returncode
        except Exception as e:
            self._logger.error(f"编译 {svc_name} 失败: {e}")
            return None

    def reload_config(self) -> None:
        """重新加载配置（供 UI 调用）。"""
        self._reload_config()
        self.refresh_status()



