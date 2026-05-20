"""Dark / Light 双主题 CSS 定义与运行时切换。

变量 $name 在 Textual CSS 中自动识别，
通过 switch_theme() 运行时热切换。
"""

from __future__ import annotations

# ── CSS 变量字典 ──

DARK_VARS: dict[str, str] = {
    "surface-darken-1": "#0d1117",
    "surface": "#161b22",
    "surface-lighten-1": "#30363d",
    "panel-darken-2": "#21262d",
    "text": "#e6edf3",
    "text-muted": "#8b949e",
    "text-faint": "#484f58",
    "accent-green": "rgb(63,185,80)",
    "accent-blue": "rgb(88,166,255)",
    "accent-orange": "rgb(240,136,62)",
    "accent-gold": "rgb(210,153,34)",
    "accent-red": "rgb(248,81,73)",
}

LIGHT_VARS: dict[str, str] = {
    "surface-darken-1": "#ffffff",
    "surface": "#f6f8fa",
    "surface-lighten-1": "#d0d7de",
    "panel-darken-2": "#d8dee4",
    "text": "#1f2328",
    "text-muted": "#656d76",
    "text-faint": "#8b949e",
    "accent-green": "#1a7f37",
    "accent-blue": "#0969da",
    "accent-orange": "#bf8700",
    "accent-gold": "#9a6700",
    "accent-red": "#cf222e",
}

ALL_THEMES = {"github-dark": DARK_VARS, "github-light": LIGHT_VARS}


# ── 公共 CSS（主题无关，使用 $variable 引用） ──

BASE_CSS = """
Screen {
    background: $surface-darken-1;
    color: $text;
}

/* 侧边栏 */
#sidebar {
    background: $surface;
    border-right: solid $surface-lighten-1;
    width: 20%;
    min-width: 20;
}

#sidebar-header {
    height: 3;
    padding: 1 1;
    content-align: center middle;
}

#sidebar-header > .logo {
    color: $accent-blue;
    text-style: bold;
}

#sidebar-header > .project-name {
    color: $text-muted;
}

.sidebar-tab {
    background: transparent;
    color: $text-muted;
    padding: 1 2;
    height: 3;
}

.sidebar-tab:hover {
    background: $surface-lighten-1;
    color: $text;
}

.sidebar-tab.-active {
    background: $surface-lighten-1;
    color: $accent-blue;
    border-left: thick $accent-blue;
}

/* 底部状态栏 */
#status-footer {
    background: $surface-darken-1;
    color: $text-muted;
    border-top: solid $surface-lighten-1;
    height: 1;
}

/* 概览 Tab 内容区 */
OverviewScreen {
    background: $surface-darken-1;
}

#filter-bar {
    height: 3;
    padding: 1 2;
}

#filter-bar > Select {
    width: 16;
    margin: 0 1;
}

#kpi-container {
    height: 6;
    padding: 0 1;
}

/* KPI 卡片 */
KPICard {
    background: $surface;
    border: solid $surface-lighten-1;
    border-top: tall;
    height: 4;
    padding: 1 2;
    margin: 0 1;
}

/* DataTable */
DataTable {
    background: $surface;
}

DataTable > .datatable-header {
    background: $surface-darken-1;
    color: $text-muted;
}

DataTable > .datatable-cursor {
    background: $surface-lighten-1;
}

/* 输入框 */
Input {
    background: $surface-darken-1;
    color: $text;
    border: solid $surface-lighten-1;
}

Input:focus {
    border: solid $accent-blue;
}

/* 下拉框 */
Select {
    background: $surface-darken-1;
    color: $text;
    border: solid $surface-lighten-1;
}

Select > .select-label {
    background: $surface-darken-1;
    color: $text;
}

/* 按钮 */
Button {
    background: $panel-darken-2;
    color: $text-muted;
    border: solid $surface-lighten-1;
}

Button:hover {
    background: $surface-lighten-1;
    color: $text;
}

Button.-primary {
    background: $accent-blue;
    color: $surface-darken-1;
}

/* 详情面板 */
DetailPanel {
    background: $surface;
    border-top: solid $surface-lighten-1;
    padding: 1 2;
}

/* 工具类 */
.muted { color: $text-muted; }
.faint { color: $text-faint; }
.delta-up { color: $accent-green; }
.delta-down { color: $accent-red; }

/* 标签 */
.label-accent-green { color: $accent-green; }
.label-accent-blue { color: $accent-blue; }
.label-accent-orange { color: $accent-orange; }
.label-accent-gold { color: $accent-gold; }

/* Setting form */
#settings-container {
    padding: 1 2;
}

#settings-container > .setting-row {
    height: 3;
    padding: 0 1;
}

#settings-container > Static { 
    padding: 1 1;
}

/* 快捷键表格 */
#shortcut-table {
    height: auto;
    max-height: 20;
}

/* 汇总统计 */
#summary-bar {
    height: 1;
    padding: 0 2;
}

/* 分页 */
#pagination-container {
    height: 3;
    padding: 0 2;
}

/* 帮助弹窗 */
HelpDialog {
    background: $surface;
    border: solid $surface-lighten-1;
    width: 50%;
    height: 60%;
}

/* 项目切换弹窗 */
ProjectSwitcher {
    background: $surface;
    border: solid $surface-lighten-1;
    width: 40%;
    height: 50%;
}

/* 确认退出弹窗 */
QuitDialog {
    background: $surface;
    border: solid $accent-red;
    width: 30;
    height: 8;
    padding: 1 2;
}
"""


# ── 主题构建与切换 ──

def build_theme_css(theme: str) -> str:
    """按主题拼接完整 CSS：变量声明 + 公共样式。"""
    vars_dict = ALL_THEMES.get(theme, DARK_VARS)
    var_lines = [f"${k}: {v};" for k, v in vars_dict.items()]
    return "\n".join(var_lines) + "\n" + BASE_CSS


def switch_theme(app, theme: str) -> None:
    """运行时切换主题。

    重新构建完整 CSS（变量声明嵌入 CSS 文本）并通过
    app.set_stylesheet() 应用到整个应用。
    """
    new_css = build_theme_css(theme)
    app.set_stylesheet(new_css)
    app.refresh()
