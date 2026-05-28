# -*- coding: utf-8 -*-
"""
本地开发控制台 — Python 版本
原 local_dev.bat 的 Python 重写，解决 Windows cmd.exe 下 UTF-8 中文乱码问题。
存放于 local_server/，由根目录 local_dev.py 启动器调用。
Python 3 原生 UTF-8，无需 chcp 切换代码页。
"""

import base64
import datetime
import json
import os
import subprocess
import sys
import time

# ── 路径配置 ──────────────────────────────────────────────
# 脚本位于 local_server/，项目根目录是其上一级
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPOSE_DIR = os.path.join(ROOT_DIR, "local_server")
COMPOSE_FILE = os.path.join(COMPOSE_DIR, "docker-compose.yml")
ENV_FILE = os.path.join(COMPOSE_DIR, ".env")
CONFIG_FILE = os.path.join(COMPOSE_DIR, "service_config.json")

# ── 服务定义 ──────────────────────────────────────────────

SERVER_SERVICES = [
    {"name": "FTG Server",       "dir": "apps/ftg/server",     "command": "npm run dev",       "port": 3000, "build": "npm run build"},
    {"name": "Game1 Server",     "dir": "apps/game1/server",   "command": "npm run dev",       "port": 3004, "build": "npm run build"},
    {"name": "Tavern Server",    "dir": "apps/tavern/server",  "command": "npm run dev",       "port": 3002, "build": "npm run build"},
    {"name": "Dashboard Admin",  "dir": "dashboard",           "command": "npm run dev:admin", "port": 3001, "build": "npm run build"},
    {"name": "Dashboard Front",  "dir": "dashboard",           "command": "npm run dev",       "port": 5173, "build": "npm run build"},
    {"name": "Tavern H5 Web",    "dir": "apps/tavern/client",  "command": "npm run dev:web",   "port": 5174, "build": "npm run build:web"},
]


# ── 服务配置持久化 ───────────────────────────────────────

def load_service_config() -> list[str]:
    """读取已启用的服务名称列表，缺失则默认全部启用"""
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("enabled", [s["name"] for s in SERVER_SERVICES])
    except (FileNotFoundError, json.JSONDecodeError):
        return [s["name"] for s in SERVER_SERVICES]


def save_service_config(enabled: list[str]):
    """保存启用的服务名称列表"""
    os.makedirs(COMPOSE_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"enabled": enabled}, f, ensure_ascii=False, indent=2)


def get_enabled_services() -> list[dict]:
    """返回启用的服务列表（按 SERVER_SERVICES 顺序）"""
    enabled_names = set(load_service_config())
    return [s for s in SERVER_SERVICES if s["name"] in enabled_names]


# ── 工具函数 ──────────────────────────────────────────────

def clear_screen():
    """清屏"""
    os.system("cls" if os.name == "nt" else "clear")


def pause():
    """按任意键继续"""
    input("\n按 Enter 键返回菜单...")


def run_command(cmd: list[str], cwd: str | None = None, check: bool = False) -> int:
    """
    运行命令，实时输出到终端。
    返回 exit code。
    """
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            shell=True if isinstance(cmd, str) else False,
            check=False,
        )
        return result.returncode
    except FileNotFoundError:
        print(f"\n  ⚠ 命令未找到: {cmd[0] if isinstance(cmd, list) else cmd}")
        return 1
    except KeyboardInterrupt:
        print("\n  操作已取消")
        return 130


def docker_compose(args: list[str]) -> int:
    """运行 docker compose 命令"""
    cmd = ["docker", "compose", "-f", COMPOSE_FILE, "--env-file", ENV_FILE] + args
    return run_command(cmd)


# ── 功能模块 ──────────────────────────────────────────────

def start_infra():
    """[1] 启动基础设施 (MySQL + Redis)"""
    clear_screen()
    print("=" * 60)
    print("  启动基础设施")
    print("=" * 60)
    print(f"\n  启动 MySQL (3307) + Redis (6379)...\n")

    code = docker_compose(["up", "-d"])
    if code != 0:
        print("\n  ⚠ Docker 启动失败，请确认 Docker Desktop 已运行。")
        print("  下载: https://www.docker.com/products/docker-desktop/")
        pause()
        return

    print("\n  等待 MySQL 就绪...")
    time.sleep(5)
    print("  基础设施已启动！\n")
    print("    MySQL: localhost:3307 (user: dev_user / pass: dev_pass_123)")
    print("    Redis: localhost:6379")
    pause()


def stop_infra():
    """[2] 停止基础设施"""
    clear_screen()
    print("=" * 60)
    print("  停止基础设施")
    print("=" * 60 + "\n")

    docker_compose(["down"])
    print("\n  基础设施已停止（数据保留）。")
    pause()


def _check_occupied_ports(enabled: list[dict]) -> list[dict]:
    """返回 enabled 中端口已被占用的服务列表"""
    try:
        netstat_output = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, check=False,
        ).stdout
    except FileNotFoundError:
        return []

    occupied = []
    for svc in enabled:
        port = svc["port"]
        for line in netstat_output.splitlines():
            if f":{port} " in line and "LISTENING" in line:
                occupied.append(svc)
                break
    return occupied


def start_servers():
    """[3] 启动所有服务（Windows Terminal 多标签页，日志自动保存）"""
    clear_screen()
    print("=" * 60)
    print("  启动所有服务")
    print("=" * 60)

    enabled = get_enabled_services()
    if not enabled:
        print("\n  ⚠ 未配置任何启用的服务，请先使用 [6] 配置启动服务项。")
        pause()
        return

    # ── 端口占用检查 ──────────────────────────────────────────────
    occupied = _check_occupied_ports(enabled)
    if occupied:
        print(f"\n  ⚠ 以下端口已被占用:\n")
        for svc in occupied:
            print(f"    {svc['name']:20s} ({svc['port']})")
        ans = input("\n  是否执行 [7] 杀死占用进程？(Y/n): ").strip().upper()
        if ans != "N":
            kill_port_processes()
            # 再检查一次，跳过仍未释放的端口
            enabled = [s for s in enabled if s not in _check_occupied_ports(enabled)]
            if not enabled:
                print("\n  所有启用服务的端口均被占用，无法启动。")
                pause()
                return

    print(f"\n  将启动 {len(enabled)}/{len(SERVER_SERVICES)} 个已启用的服务...\n")
    print("  日志保存至: local_server/logs/{服务名}/{YYYY-MM-DD HH-MM-SS}.log\n")

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H-%M-%S")
    log_base = os.path.join(COMPOSE_DIR, "logs")
    runner_path = os.path.join(COMPOSE_DIR, "log-runner.js")

    # subprocess.run 直接调用 wt.exe，绕过 cmd.exe 8191 字符限制
    cmd = ["wt"]
    for i, svc in enumerate(enabled):
        name = svc["name"]
        title = f"{svc['name']} ({svc['port']})"
        workdir = os.path.join(ROOT_DIR, svc["dir"])
        command = svc["command"]
        safe_name = name.replace(" ", "_")
        log_dir = os.path.join(log_base, safe_name)
        log_file = os.path.join(log_dir, f"{timestamp}.log")

        # 转义单引号：PowerShell 单引号字符串中 '' 表示字面单引号
        title_ps = title.replace("'", "''")
        workdir_ps = workdir.replace("'", "''")
        log_file_ps = log_file.replace("'", "''")
        runner_ps = runner_path.replace("'", "''")

        # ── 干净日志方案 ───────────────────────────────────────────────
        # 使用 Node.js log-runner.js 包装器替代 PowerShell Tee-Object：
        #   - 直接捕获子进程 stdout/stderr，避免 NativeCommandError 包装
        #   - 自动剥离 ANSI 转义码，日志文件只有纯文本
        #   - 文件写入 UTF-8（无 BOM）
        #   - 终端保持原有颜色输出
        # ────────────────────────────────────────────────────────────────
        ps_code = (
            f"$Host.UI.RawUI.WindowTitle = '{title_ps}'\n"
            f"Set-Location '{workdir_ps}'\n"
            f"$logFile = '{log_file_ps}'\n"
            f"$runner = '{runner_ps}'\n"
            f"$logDir = [System.IO.Path]::GetDirectoryName($logFile)\n"
            f"if (-not (Test-Path $logDir)) {{ New-Item -ItemType Directory -Path $logDir -Force | Out-Null }}\n"
            f'Write-Host "[日志] $logFile" -ForegroundColor Cyan\n'
            f'node "$runner" "$logFile" {command}\n'
        )
        ps_bytes = ps_code.encode("utf-16-le")
        encoded = base64.b64encode(ps_bytes).decode("ascii")

        if i > 0:
            cmd.append(";")
            cmd.append("new-tab")
        cmd.extend([
            "--title", title,
            "-d", workdir,
            "powershell", "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded,
        ])
        print(f"  已加载: {title}")
        print(f"      日志: {log_file}")

    try:
        subprocess.run(cmd, check=False)
    except FileNotFoundError:
        print("\n  ⚠ 未找到 Windows Terminal (wt.exe)。")
        print("  请确保已安装 Windows Terminal: https://aka.ms/terminal")
    except Exception as e:
        print(f"\n  ⚠ 启动失败: {e}")

    print(f"\n  所有服务已启动！（日志自动保存至 local_server/logs/ 目录）")
    pause()


def restart_all():
    """[4] 重启所有服务"""
    clear_screen()
    print("=" * 60)
    print("  重启所有服务")
    print("=" * 60)
    print("\n  步骤 1/2: 停止正在运行的 Node 进程...\n")
    os.system("taskkill /f /im node.exe 2>nul")
    print("  Node 进程已清理。\n")

    print("  步骤 2/2: 启动所有服务...\n")
    start_servers()


def clean_logs():
    """[5] 清理缓存与日志"""
    import msvcrt
    import shutil

    # 清理项定义: (显示名称, 绝对路径)
    items = [
        (".playwright-mcp/",     os.path.join(ROOT_DIR, ".playwright-mcp")),
        ("tmp/",                 os.path.join(ROOT_DIR, "tmp")),
        ("local_server/logs/",   os.path.join(COMPOSE_DIR, "logs")),
    ]

    while True:
        clear_screen()
        print("=" * 60)
        print("  清理缓存与日志")
        print("=" * 60)
        print("\n  [0] 清理")
        print("  [Esc/Q] 返回\n")

        for name, path in items:
            marker = "✓" if os.path.exists(path) else "✗ (不存在)"
            print(f"  - {name:25s} {marker}")

        print()
        sys.stdout.write("请选择: ")
        sys.stdout.flush()
        key = msvcrt.getch()

        if key == b'\xe0':
            key2 = msvcrt.getch()
            if key2 == b'G':  # Home → 返回
                return

        if key in (b'q', b'Q', b'\x1b'):
            return

        if key == b'0':
            clear_screen()
            print("=" * 60)
            print("  清理缓存与日志")
            print("=" * 60)

            total_size = 0

            for name, path in items:
                if not os.path.exists(path):
                    print(f"\n  ⏭ {name} 不存在，跳过。")
                    continue

                size = 0
                if os.path.isdir(path):
                    for root, dirs, files in os.walk(path):
                        for f in files:
                            fp = os.path.join(root, f)
                            try:
                                size += os.path.getsize(fp)
                            except OSError:
                                pass
                    try:
                        shutil.rmtree(path)
                    except OSError:
                        print(f"\n  ⚠ {name} 删除失败，可能有文件被占用。")
                        continue
                else:
                    try:
                        size = os.path.getsize(path)
                        os.remove(path)
                    except OSError:
                        print(f"\n  ⚠ {name} 删除失败。")
                        continue

                total_size += size
                size_mb = size / (1024 * 1024)
                print(f"  ✅ {name:25s} 已清理 ({size_mb:.2f} MB)")

            total_mb = total_size / (1024 * 1024)
            print(f"\n  共释放 {total_mb:.2f} MB。")
            pause()
            return


def configure_services():
    """[6] 配置启动服务项（方向键 + Space 多选）"""
    import msvcrt

    current = set(load_service_config())
    services = SERVER_SERVICES
    sel = 0  # 当前光标行

    while True:
        clear_screen()
        print("=" * 60)
        print("  配置启动服务项")
        print("=" * 60)
        print("  (↑↓ 移动, Space 切换, Enter 保存, Esc/Q 放弃)\n")

        for i, svc in enumerate(services):
            checked = svc["name"] in current
            mark = "✓" if checked else " "
            cursor = "▸" if i == sel else " "
            print(f"  {cursor} [{mark}] {svc['name']:20s} ({svc['port']})")

        key = msvcrt.getch()

        if key == b'\xe0':  # 方向键 / Home
            key2 = msvcrt.getch()
            if key2 == b'H':   # ↑
                sel = (sel - 1) % len(services)
            elif key2 == b'P':  # ↓
                sel = (sel + 1) % len(services)
            elif key2 == b'G':  # Home → 放弃
                print("\n  已放弃修改。")
                pause()
                return
        elif key == b' ':  # Space — 切换选中项
            name = services[sel]["name"]
            if name in current:
                current.remove(name)
            else:
                current.add(name)
        elif key == b'\r':  # Enter — 保存
            save_service_config(list(current))
            clear_screen()
            print(f"\n  ✅ 已保存 {len(current)}/{len(services)} 个服务配置。")
            pause()
            return
        elif key in (b'\x1b', b'q', b'Q'):  # Esc / Q — 放弃
            print("\n  已放弃修改。")
            pause()
            return


def kill_port_processes():
    """[7] 杀死占用启动服务项端口的进程"""
    clear_screen()
    print("=" * 60)
    print("  杀死占用端口的进程")
    print("=" * 60)

    enabled = get_enabled_services()
    if not enabled:
        print("\n  ⚠ 未配置任何启用的服务，请先使用 [6] 配置启动服务项。")
        pause()
        return

    print(f"\n  正在扫描 {len(enabled)} 个已启用服务的端口...\n")

    # 一次获取所有 LISTENING 连接，避免重复调用 netstat
    netstat_output = ""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, check=False,
        )
        netstat_output = result.stdout
    except FileNotFoundError:
        print("\n  ⚠ 未找到 netstat 命令。")
        pause()
        return

    total_killed = 0
    for svc in enabled:
        port = svc["port"]
        name = svc["name"]
        pids = set()
        for line in netstat_output.splitlines():
            if f":{port} " in line and "LISTENING" in line:
                parts = line.strip().split()
                if parts:
                    try:
                        pids.add(int(parts[-1]))
                    except ValueError:
                        pass

        if not pids:
            print(f"  {name:20s} ({port})  →  无占用")
            continue

        killed = 0
        for pid in pids:
            code = subprocess.run(
                ["taskkill", "/f", "/pid", str(pid)],
                capture_output=True, text=True, check=False,
            ).returncode
            if code == 0:
                killed += 1

        if killed > 0:
            total_killed += killed
            print(f"  {name:20s} ({port})  →  已杀死 {killed} 个进程 (PID: {', '.join(map(str, pids))})")
        else:
            print(f"  {name:20s} ({port})  →  无权限 (PID: {', '.join(map(str, pids))})")

    if total_killed > 0:
        print(f"\n  共杀死 {total_killed} 个进程。")
    else:
        print(f"\n  无需清理。")
    pause()


def _build_one(svc: dict) -> int:
    """编译单个服务项，返回 exit code"""
    workdir = os.path.join(ROOT_DIR, svc["dir"])
    print(f"\n  {'=' * 56}")
    print(f"  编译: {svc['name']}")
    print(f"  目录: {workdir}")
    print(f"  命令: {svc['build']}")
    print(f"  {'=' * 56}\n")

    if not os.path.isdir(os.path.join(workdir, "node_modules")):
        print("  ⚠ 未检测到 node_modules，请先执行 npm install。\n")

    return run_command(svc["build"], cwd=workdir)


def rebuild_service():
    """[8] 重新编译所选服务项或项目"""
    import msvcrt

    while True:
        clear_screen()
        print("=" * 60)
        print("  重新编译所选服务项或项目")
        print("=" * 60)
        print("\n  [0] 重新编译所有")
        print()

        for i, svc in enumerate(SERVER_SERVICES):
            print(f"  [{i + 1}] {svc['name']:20s}  ({svc['build']})")

        print()
        sys.stdout.write("请选择 (0-6/Q): ")
        sys.stdout.flush()
        key = msvcrt.getch()

        if key == b'\xe0':
            key2 = msvcrt.getch()
            if key2 == b'G':  # Home → 返回
                return
            continue

        choice = key.decode('ascii', errors='ignore').upper()

        if choice == "Q":
            return

        if not choice.isdigit():
            continue

        idx = int(choice)

        if idx == 0:
            clear_screen()
            print("=" * 60)
            print("  重新编译所有服务项")
            print("=" * 60)

            ok = fail = 0
            for svc in SERVER_SERVICES:
                code = _build_one(svc)
                if code == 0:
                    print(f"  ✅ {svc['name']} 编译成功")
                    ok += 1
                else:
                    print(f"  ⚠ {svc['name']} 编译失败 (exit code: {code})")
                    fail += 1

            print(f"\n  {'=' * 56}")
            print(f"  完成：{ok} 成功，{fail} 失败")
            pause()
            continue

        idx -= 1
        if not (0 <= idx < len(SERVER_SERVICES)):
            continue

        svc = SERVER_SERVICES[idx]
        clear_screen()
        code = _build_one(svc)

        if code == 0:
            print(f"\n  ✅ {svc['name']} 编译成功！")
        else:
            print(f"\n  ⚠ {svc['name']} 编译失败 (exit code: {code})")

        pause()


# ── 主菜单 ────────────────────────────────────────────────

MENU = """
  [1] 启动基础设施 (MySQL + Redis)
  [2] 停止基础设施
  [3] 启动所有服务
  [4] 重启所有服务
  [5] 清理缓存与日志
  [6] 配置启动服务项
  [7] 杀死占用启动服务项端口的进程
  [8] 重新编译所选服务项或项目

  [Q] 退出
"""


def main():
    """主循环"""
    import msvcrt

    while True:
        clear_screen()
        print("=" * 60)
        print("  本地开发控制台")
        print("=" * 60)
        print(MENU)

        sys.stdout.write("请选择 (1-8/Q): ")
        sys.stdout.flush()
        key = msvcrt.getch()

        if key == b'\xe0':
            key2 = msvcrt.getch()
            if key2 == b'G':  # Home → 退出
                print("\n  再见！")
                sys.exit(0)
            continue

        choice = key.decode('ascii', errors='ignore').upper()

        if choice == "1":
            start_infra()
        elif choice == "2":
            stop_infra()
        elif choice == "3":
            start_servers()
        elif choice == "4":
            restart_all()
        elif choice == "5":
            clean_logs()
        elif choice == "6":
            configure_services()
        elif choice == "7":
            kill_port_processes()
        elif choice == "8":
            rebuild_service()
        elif choice == "Q":
            print("\n  再见！")
            sys.exit(0)
        # 无效输入 → 重新显示菜单


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  再见！")
        sys.exit(0)
