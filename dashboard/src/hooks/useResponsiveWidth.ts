import useMobile from './useMobile'

interface ResponsiveWidthConfig {
  mobile: string
  desktop: number
}

export function useResponsiveWidth(config: ResponsiveWidthConfig): string {
  const isMobile = useMobile()
  return isMobile ? config.mobile : `${config.desktop}px`
}
