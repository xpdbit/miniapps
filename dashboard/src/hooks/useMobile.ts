import { useState, useEffect } from 'react'

/**
 * 响应式断点检测 hook
 * @param breakpoint 断点值 (px)，默认 576 (antd sm)
 * @returns 当前是否为移动端
 */
const useMobile = (breakpoint = 576): boolean => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => {
      mq.removeEventListener('change', handler)
    }
  }, [breakpoint])

  return isMobile
}

export default useMobile
