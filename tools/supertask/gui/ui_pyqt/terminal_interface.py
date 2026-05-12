# -*- coding: utf-8 -*-
"""terminal_interface.py — QProcess 驱动终端面板（命令执行 + 输出显示）"""
import re
import subprocess
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QTextEdit, QLineEdit, QPushButton)
from PyQt6.QtCore import Qt, QProcess
from qfluentwidgets import BodyLabel, CaptionLabel

# 匹配 ANSI 转义序列（颜色、光标移动等控制码）
_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')


class TerminalInterface(QWidget):
    """终端面板 —— 支持 opencode 命令和 shell 命令"""

    def __init__(self, working_dir: str = "", parent=None):
        super().__init__(parent)
        self._working_dir = working_dir
        self._process: QProcess | None = None
        self._history: list[str] = []
        self._history_idx = -1

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)

        # 工具栏
        toolbar = QHBoxLayout()
        toolbar.addWidget(BodyLabel("终端"))
        toolbar.addStretch()
        clear_btn = QPushButton("清空", self)
        clear_btn.setFixedWidth(80)
        toolbar.addWidget(clear_btn)
        layout.addLayout(toolbar)

        # 输出区
        self._output = QTextEdit(self)
        self._output.setReadOnly(True)
        self._output.setStyleSheet("""
            QTextEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 8px;
                padding: 8px;
                font-family: "Consolas", "Microsoft YaHei", monospace;
                font-size: 12px;
            }
        """)
        layout.addWidget(self._output)

        # 输入区
        input_row = QHBoxLayout()
        self._input = QLineEdit(self)
        self._input.setPlaceholderText("输入命令 (Enter 执行)...")
        self._input.setStyleSheet("""
            QLineEdit {
                background-color: #0d1117; color: #c9d1d9;
                border: 1px solid #30363d; border-radius: 6px;
                padding: 8px 12px;
                font-family: "Consolas", "Microsoft YaHei", monospace;
                font-size: 12px;
            }
        """)
        self._input.returnPressed.connect(self._on_command)
        send_btn = QPushButton("发送", self)
        send_btn.clicked.connect(self._on_command)

        input_row.addWidget(self._input, 1)
        input_row.addWidget(send_btn)
        layout.addLayout(input_row)

        # 状态栏
        self._status = CaptionLabel("就绪", self)
        layout.addWidget(self._status)

        clear_btn.clicked.connect(self._output.clear)

        # 键盘事件：Up/Down 切换历史
        self._input.keyPressEvent = self._input_key_press

    def _input_key_press(self, event):
        if event.key() == Qt.Key.Key_Up:
            self._history_up()
        elif event.key() == Qt.Key.Key_Down:
            self._history_down()
        else:
            QLineEdit.keyPressEvent(self._input, event)

    def _history_up(self):
        if not self._history:
            return
        if self._history_idx > 0:
            self._history_idx -= 1
        self._input.setText(self._history[self._history_idx])

    def _history_down(self):
        if self._history_idx >= len(self._history) - 1:
            self._history_idx = len(self._history)
            self._input.clear()
            return
        self._history_idx += 1
        self._input.setText(self._history[self._history_idx])

    def _on_command(self):
        text = self._input.text().strip()
        if not text:
            return
        self._history.append(text)
        self._history_idx = len(self._history)
        self._input.clear()
        self._append_output(f"> {text}\n", "#58a6ff")

        if text.startswith("opencode"):
            self._run_opencode(text)
        else:
            self._run_shell(text)

    def _run_shell(self, command: str):
        try:
            result = subprocess.run(
                command, shell=True,
                cwd=self._working_dir or None,
                capture_output=True, text=True, timeout=30,
            )
            out = (result.stdout or "") + (result.stderr or "")
            self._append_output(out.strip() + "\n" if out else "(无输出)\n")
        except subprocess.TimeoutExpired:
            self._append_output("错误: 命令超时 (30s)\n", "#f85149")
        except Exception as e:
            self._append_output(f"错误: {e}\n", "#f85149")

    def _run_opencode(self, command: str):
        self._status.setText("运行中...")
        if self._process:
            self._process.kill()
        self._process = QProcess(self)
        self._process.setWorkingDirectory(self._working_dir)
        self._process.readyReadStandardOutput.connect(self._on_stdout)
        self._process.readyReadStandardError.connect(self._on_stderr)
        self._process.finished.connect(self._on_finished)
        cmd = command[len("opencode"):].strip()
        self._process.start("opencode", ["run", cmd] if cmd else ["run"])

    def _on_stdout(self):
        if self._process:
            data = self._process.readAllStandardOutput().data().decode("utf-8", errors="replace")
            self._append_output(data)

    def _on_stderr(self):
        if self._process:
            data = self._process.readAllStandardError().data().decode("utf-8", errors="replace")
            self._append_output(data, "#f85149")

    def _on_finished(self, exit_code, exit_status):
        self._status.setText(f"完成 (退出码: {exit_code})")

    def _append_output(self, text: str, color: str = "#c9d1d9"):
        # 过滤 ANSI 转义序列（颜色码、光标控制等），避免干扰 HTML 渲染
        text = _ANSI_RE.sub('', text)
        safe_text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        # 将换行符转为 <br> 标签，使 HTML 渲染保留段落/换行
        safe_text = safe_text.replace("\r\n", "\n").replace("\n", "<br>")
        html = f'<span style="color:{color}">{safe_text}</span>'
        self._output.insertHtml(html)
        sb = self._output.verticalScrollBar()
        sb.setValue(sb.maximum())

    def send_command(self, text: str):
        """外部调用：发送命令到终端"""
        self._input.setText(text)
        self._on_command()

    def is_running(self) -> bool:
        return self._process is not None and self._process.state() != QProcess.ProcessState.NotRunning

    def send_prompt(self, prompt: str):
        """通过 QProcess stdin 发送 prompt 到 opencode（供 LoopManager 调用）。
        与 send_command 不同，此方法不经过输入框和命令历史，
        直接将 prompt 通过 stdin 管道传给 opencode。"""
        # 等待并终止旧进程
        if self._process:
            self._process.kill()

        # 显示简短提示而非完整 prompt
        first_line = prompt.split('\n')[0]
        short = first_line[:80] + "..." if len(first_line) > 80 else first_line
        self._append_output(f"> [prompt] {short}\n", "#58a6ff")

        # 启动 opencode run 并通过 stdin 传入 prompt
        self._process = QProcess(self)
        self._process.setWorkingDirectory(self._working_dir)
        self._process.readyReadStandardOutput.connect(self._on_stdout)
        self._process.readyReadStandardError.connect(self._on_stderr)
        self._process.finished.connect(self._on_finished)

        self._status.setText("运行中...")
        self._process.start("opencode", ["run"])
        self._process.write(prompt.encode('utf-8'))
        self._process.closeWriteChannel()

    def append_output(self, text: str):
        """外部调用：追加输出文本"""
        self._append_output(text)
