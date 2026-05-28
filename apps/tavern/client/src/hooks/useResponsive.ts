import { useState, useEffect } from 'react'

export interface ResponsiveInfo {
  /** 是否为微信小程序环境 */
  isWeapp: boolean
  /** 是否为桌面浏览器（H5 且宽度 >= 1024px） */
  isDesktop: boolean
  /** 是否为移动端浏览器（H5 且宽度 < 1024px） */
  isMobile: boolean
  /** 当前窗口宽度 */
  windowWidth: number
}

const BREAKPOINT_DESKTOP = 768

export function useResponsive(): ResponsiveInfo {
  const isWeapp = process.env.TARO_ENV === 'weapp'
  const [windowWidth, setWindowWidth] = useState(() => {
    if (isWeapp) return 375
    if (typeof window !== 'undefined') return window.innerWidth
    return 375
  })

  useEffect(() => {
    if (isWeapp) return

    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [isWeapp])

  return {
    isWeapp,
    isDesktop: !isWeapp && windowWidth >= BREAKPOINT_DESKTOP,
    isMobile: !isWeapp && windowWidth < BREAKPOINT_DESKTOP,
    windowWidth,
  }
}
