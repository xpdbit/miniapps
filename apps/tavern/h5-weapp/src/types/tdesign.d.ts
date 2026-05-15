/* TDesign Miniprogram 组件类型声明 — 用于 Taro JSX */
declare namespace JSX {
  interface IntrinsicElements {
    't-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      theme?: 'primary' | 'danger' | 'default' | 'light'
      size?: 'small' | 'medium' | 'large'
      variant?: 'base' | 'outline' | 'text'
      disabled?: boolean
      loading?: boolean
      block?: boolean
      icon?: string
      onClick?: (e: unknown) => void
    }
    't-dialog': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      visible?: boolean
      title?: string
      content?: string
      confirmBtn?: string
      cancelBtn?: string
      onClose?: (e: unknown) => void
      onConfirm?: (e: unknown) => void
      onCancel?: (e: unknown) => void
    }
    't-input': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      value?: string
      label?: string
      placeholder?: string
      disabled?: boolean
      clearable?: boolean
      errorMessage?: string
      maxlength?: number
      type?: string
      password?: boolean
      className?: string
      style?: string | Record<string, string>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange?: (e: any) => void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onInput?: (e: any) => void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onBlur?: (e: any) => void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onFocus?: (e: any) => void
    }
    't-textarea': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      value?: string
      placeholder?: string
      disabled?: boolean
      maxlength?: number
      className?: string
      onChange?: (e: CustomEvent<{ value: string }>) => void
      onInput?: (e: { detail: { value: string } }) => void
    }
    't-switch': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      value?: boolean
      disabled?: boolean
      label?: string
      onChange?: (e: { detail: { value: boolean } }) => void
    }
    't-tabs': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      value?: string
      theme?: 'line' | 'tag' | 'card'
      spaceEvenly?: boolean
      animation?: boolean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange?: (key: any) => void
    }
    't-tab-panel': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      label?: string
      value?: string
    }
    't-avatar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      image?: string
      size?: 'small' | 'medium' | 'large' | 'extralarge'
      shape?: 'circle' | 'square'
      icon?: string
      badgeProps?: Record<string, unknown>
    }
    't-badge': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      content?: string
      count?: number
      dot?: boolean
      maxCount?: number
      shape?: 'circle' | 'square' | 'round'
      size?: 'small' | 'medium'
    }
    't-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      theme?: 'primary' | 'success' | 'warning' | 'danger' | 'default'
      size?: 'small' | 'medium'
      variant?: 'light' | 'dark' | 'outline'
      closable?: boolean
      icon?: string
      onClick?: (e: unknown) => void
    }
    't-cell': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      title?: string
      note?: string
      arrow?: boolean
      leftIcon?: string
      hover?: boolean
      onClick?: (e: unknown) => void
    }
    't-cell-group': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      theme?: string
    }
    't-divider': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      content?: string
      align?: 'left' | 'center' | 'right'
      dashed?: boolean
    }
    't-skeleton': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      loading?: boolean
      animation?: string
      rowCol?: unknown[]
    }
    't-empty': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      icon?: string
      description?: string
    }
    't-loading': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      theme?: 'circular' | 'spinner'
      size?: string
      text?: string
      loading?: boolean
    }
    't-progress': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      percentage?: number
      label?: string
      theme?: 'line' | 'plump' | 'circle'
      status?: string
    }
    't-popup': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      visible?: boolean
      placement?: string
      onVisibleChange?: (visible: boolean) => void
    }
    't-toast': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      id?: string
    }
    't-navbar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      title?: string
      leftArrow?: boolean
      onLeftClick?: () => void
    }
    't-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      name?: string
      size?: string
      color?: string
    }
    't-action-sheet': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      visible?: boolean
      items?: unknown[]
      onClose?: () => void
      onSelected?: (e: unknown) => void
    }
  }
}
