#!/usr/bin/env node
// =============================================================================
// log-runner.js — 干净日志包装器
//
// 用法: node log-runner.js <log文件路径> <命令...>
// 示例: node log-runner.js ./logs/app.log npm run dev
//
// 功能:
//   - 直接捕获子进程 stdout/stderr，避免 PowerShell NativeCommandError 包装
//   - 文件写入 UTF-8（无 BOM），终端保持原有颜色输出
//   - 自动去除 ANSI 转义码，日志文件只有纯文本
//   - 自动创建日志目录
// =============================================================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── ANSI 转义码剥离 ──────────────────────────────────────
// 移除所有 ANSI 转义序列（颜色、光标移动、清屏、窗口标题等）
function stripAnsi(str) {
  return str
    // CSI 序列: ESC [ <参数> <字母>  (参数允许数字、分号、问号)
    .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
    // OSC 序列: ESC ] <任意文本> (BEL 或 ST 终止)
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
    // 剩余所有 ESC 序列: ESC <中间字节>* <终结字节> (ECMA-48)
    .replace(/\x1B[\x20-\x2F]*[\x30-\x7E]/g, '')
    // 控制字符: 除去 \t \n \r 之外的 0x00-0x1F 和 DEL + C1 控制区
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node log-runner.js <log文件路径> <命令...>');
  process.exit(1);
}

const logFilePath = path.resolve(args[0]);
const command = args[1];
const commandArgs = args.slice(2);

// ── 确保日志目录存在 ─────────────────────────────────────
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ── 打开日志文件（UTF-8 无 BOM） ─────────────────────────
const logStream = fs.createWriteStream(logFilePath, {
  encoding: 'utf-8',
  flags: 'w',
});

// 写入日志头
const startTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
logStream.write(`[log-runner] 启动时间: ${startTime}\n`);
logStream.write(`[log-runner] 命令: ${command} ${commandArgs.join(' ')}\n`);
logStream.write(`[log-runner] ${'='.repeat(60)}\n`);

// ── 启动子进程 ───────────────────────────────────────────
console.error(`[log-runner] 启动: ${command} ${commandArgs.join(' ')}`);
console.error(`[log-runner] 日志: ${logFilePath}`);

const child = spawn(command, commandArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  cwd: process.cwd(),
});

// ── stdout 处理 ──────────────────────────────────────────
child.stdout.on('data', (data) => {
  const text = data.toString('utf-8');
  // 终端：保留原始输出（含 ANSI 颜色）
  process.stdout.write(text);
  // 文件：剥离 ANSI 后写入
  logStream.write(stripAnsi(text));
});

// ── stderr 处理 ──────────────────────────────────────────
child.stderr.on('data', (data) => {
  const text = data.toString('utf-8');
  // 终端：保留原始输出
  process.stderr.write(text);
  // 文件：剥离 ANSI 后写入
  logStream.write(stripAnsi(text));
});

// ── 进程退出处理 ────────────────────────────────────────
child.on('error', (err) => {
  const msg = `[log-runner] 错误: ${err.message}\n`;
  process.stderr.write(msg);
  logStream.write(msg);
  logStream.end(() => process.exit(1));
});

child.on('close', (code, signal) => {
  const endTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const exitMsg = signal
    ? `[log-runner] 进程被信号 ${signal} 终止 (${endTime})\n`
    : `[log-runner] 进程退出，退出码: ${code} (${endTime})\n`;
  process.stderr.write(exitMsg);
  logStream.write(exitMsg);
  logStream.end(() => process.exit(code ?? 0));
});

// ── 父进程退出时清理子进程 ──────────────────────────────
process.on('SIGINT', () => {
  child.kill('SIGINT');
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
