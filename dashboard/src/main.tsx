import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── 开发模式下抑制已知 antd 警告 ─────────────────
// React 19 + antd v5 兼容性警告，以及静态 message API 在 React 树外使用的警告
// 这些是已知架构限制，不影响功能，生产构建时不存在
if (import.meta.env.DEV) {
  const origError = console.error.bind(console)
  const suppressed = ['[antd: compatible]', '[antd: message] Static function']
  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : ''
    if (suppressed.some((prefix) => firstArg.includes(prefix))) return
    origError(...args)
  }
}

// ── 启动时输出环境和配置 ─────────────────────────
console.log('========================================');
console.log('  Dashboard 管理后台');
console.log('========================================');
console.log(`  环境:       ${import.meta.env.MODE || '未知'}`);
console.log(`  API 地址:   ${import.meta.env.VITE_API_BASE_URL || '未配置'}`);
console.log('========================================');

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
