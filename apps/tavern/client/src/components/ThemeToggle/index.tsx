/**
 * ThemeToggle — 日夜模式切换按钮
 *
 * H5: 显示太阳/月亮图标，点击切换主题
 * 小程序: 不渲染（小程序可通过设置页面切换）
 */
import { View, ViewProps } from '@tarojs/components'
import { useThemeStore } from '@/stores/themeStore'
import { useState } from 'react'
import type { CSSProperties, MouseEventHandler, KeyboardEventHandler } from 'react'

/** Taro 的 ViewProps 缺少 H5 可访问性所需的属性，此处扩展类型 */
type AccessibleViewProps = ViewProps & {
  tabIndex?: number
  onMouseEnter?: MouseEventHandler
  onMouseLeave?: MouseEventHandler
  onKeyDown?: KeyboardEventHandler
  'aria-label'?: string
  'aria-checked'?: boolean
  role?: string
}

const H5View = View as React.ComponentType<AccessibleViewProps>

const isH5 = process.env.TARO_ENV === 'h5'

/* ---- SVG Icons (__COLOR__ 运行时替换) ---- */
const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`

function svgToDataUri(svg: string, color: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/__COLOR__/g, color))
}

/** 读取 CSS 变量的实际值，确保 SVG 图标颜色与主题同步更新 */
function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const containerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  cursor: 'pointer',
  transition: 'background 0.2s ease, transform 0.15s ease',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  background: 'var(--color-bg-muted, #F3EFE8)',
}

const iconStyle: CSSProperties = {
  width: '20px',
  height: '20px',
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
}

// 仅在 H5 平台渲染
export default function ThemeToggle() {
  const isDark = useThemeStore((s) => s.isDark)
  const toggle = useThemeStore((s) => s.toggle)
  const [isHovered, setIsHovered] = useState(false)

  if (!isH5) return null

  const hoverStyle: CSSProperties = isHovered
    ? {
        background: 'var(--color-bg-surface-hover, #F5F1EB)',
        transform: 'scale(1.1)',
        willChange: 'transform',
      }
    : {}

  const iconColor = getCssVar('--color-text-secondary', isDark ? '#8B949E' : '#7A7570')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <H5View
      style={{ ...containerStyle, ...hoverStyle }}
      onClick={toggle}
      aria-label={isDark ? '切换亮色模式' : '切换暗色模式'}
      role='switch'
      aria-checked={isDark}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
    >
      <View
        className='theme-toggle-icon'
        style={{
          ...iconStyle,
          backgroundImage: `url(${svgToDataUri(isDark ? SUN_SVG : MOON_SVG, iconColor)})`,
        }}
      />
    </H5View>
  )
}
