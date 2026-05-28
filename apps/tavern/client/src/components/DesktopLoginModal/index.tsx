/**
 * DesktopLoginModal — 桌面端登录弹窗
 *
 * 在 DesktopSidebar 中点击登录时显示，支持账号密码登录。
 * 覆盖在 sidebar 右侧，居中显示，暗色遮罩层。
 */
import { View, ViewProps, Text, Input, Button, Form } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { KeyboardEventHandler } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Icon } from '@/components'
import './index.scss'

/** Taro 的 ViewProps 缺少 H5 可访问性所需的属性，此处扩展类型 */
type AccessibleViewProps = ViewProps & {
  tabIndex?: number
  onKeyDown?: KeyboardEventHandler
  role?: string
  'aria-label'?: string
}
const H5View = View as React.ComponentType<AccessibleViewProps>

interface Props {
  visible: boolean
  onClose: () => void
}

export default function DesktopLoginModal({ visible, onClose }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { passwordLogin } = useAuthStore()

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setUsername('')
      setPassword('')
      setError(null)
      // Set autocomplete attributes on native input elements (H5 only)
      if (process.env.TARO_ENV === 'h5') {
        setTimeout(() => {
          const usernameInput = document.querySelector<HTMLInputElement>('input[name="username"]')
          const passwordInput = document.querySelector<HTMLInputElement>('input[name="password"]')
          if (usernameInput) usernameInput.setAttribute('autocomplete', 'username')
          if (passwordInput) {
            passwordInput.setAttribute('autocomplete', 'current-password')
            // Taro H5 不会自动将 password prop 转为 type="password"，需要手动设置
            passwordInput.setAttribute('type', 'password')
          }
        }, 0)
      }
    }
  }, [visible])

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }
    setLoggingIn(true)
    setError(null)
    try {
      await passwordLogin(username.trim(), password.trim())
      Taro.showToast({ title: '登录成功', icon: 'success' })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败'
      setError(msg)
    } finally {
      setLoggingIn(false)
    }
  }, [username, password, passwordLogin, onClose])

  const handleConfirm = useCallback(() => {
    if (!loggingIn) {
      handleLogin()
    }
  }, [handleLogin, loggingIn])

  // Close modal on Escape key
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, onClose])

  // Auto-focus first input + focus trap when modal opens
  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.desktop-login-modal input[name="username"]')
      input?.focus()
    }, 50)

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const modal = document.querySelector('.desktop-login-modal')
      if (!modal) return
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length < 2) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleTabKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleTabKey)
    }
  }, [visible])

  if (!visible) return null

  return (
    <View className='desktop-login-overlay' onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <View className='desktop-login-modal' role='dialog' aria-modal='true' aria-labelledby='login-modal-title' onClick={(e) => { e.stopPropagation() }}>
        {/* Header */}
        <View className='desktop-login-header'>
          <View className='desktop-login-logo'>
            <View className='desktop-login-logo-dot' />
            <Text className='desktop-login-logo-text'>AI 酒馆</Text>
          </View>
          <H5View className='desktop-login-close' onClick={(e) => { e.stopPropagation(); onClose() }} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClose() } }} role='button' aria-label='关闭登录窗口'>
            <Icon name='close' size={18} color='var(--color-text-tertiary, #A8A39E)' />
          </H5View>
        </View>

        {/* Body */}
        <Form className='desktop-login-body'>
          <Text className='desktop-login-title' id='login-modal-title'>欢迎回来</Text>
          <Text className='desktop-login-subtitle'>
            登录后与 AI 角色畅聊，解锁全部功能
          </Text>

          {error && (
            <View className='desktop-login-error'>
              <Text className='desktop-login-error-text'>{error}</Text>
            </View>
          )}

          <View className='desktop-login-field'>
            <Text className='desktop-login-label'>用户名</Text>
            <Input
              className='desktop-login-input'
              type='text'
              name='username'
              placeholder='输入用户名'
              value={username}
              onInput={(e) => setUsername(e.detail.value)}
              onConfirm={handleConfirm}
            />
          </View>

          <View className='desktop-login-field'>
            <Text className='desktop-login-label'>密码</Text>
            <Input
              className='desktop-login-input'
              type='text'
              password
              name='password'
              placeholder='输入密码'
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
              onConfirm={handleConfirm}
            />
          </View>

          <Button
            className='desktop-login-submit'
            onClick={handleLogin}
            disabled={loggingIn}
          >
            {loggingIn ? '登录中...' : '登录'}
          </Button>
        </Form>

        {/* Footer */}
        <View className='desktop-login-footer'>
          <Text className='desktop-login-footer-text'>
            网页版 · 账号密码登录
          </Text>
        </View>
      </View>
    </View>
  )
}
