/**
 * DesktopSelect — 桌面端自定义下拉选择器
 *
 * 替代 Taro `<Picker mode='selector'>`，提供 PC 风格的下拉菜单。
 * 仅在 H5 桌面端生效，移动端仍可使用原生 Picker（保留 Taro 兼容）。
 */
import { View, Text } from '@tarojs/components'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import './index.scss'

export interface DesktopSelectOption {
  label: string
  value: string | number
}

export type DesktopSelectOptions = (string | number | DesktopSelectOption)[]

interface DesktopSelectProps {
  value: number
  options: DesktopSelectOptions
  onChange: (index: number) => void
  className?: string
  children?: ReactNode
}

function normalizeOption(
  opt: string | number | DesktopSelectOption,
  index: number,
): DesktopSelectOption {
  if (typeof opt === 'object' && 'label' in opt && 'value' in opt) {
    return opt
  }
  return { label: String(opt), value: opt }
}

export default function DesktopSelect({
  value,
  options,
  onChange,
  className = '',
  children,
}: DesktopSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTrigger = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const handleSelect = useCallback(
    (index: number) => {
      onChange(index)
      setOpen(false)
    },
    [onChange],
  )

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const displayLabel =
    value >= 0 && value < options.length
      ? normalizeOption(options[value]!, value).label
      : ''

  return (
    <View className={`desktop-select ${className}`} ref={containerRef as unknown as React.Ref<HTMLElement>}>
      <View
        className={`desktop-select__trigger ${open ? 'desktop-select__trigger--open' : ''}`}
        onClick={handleTrigger}
      >
        {children ?? (
          <View className='desktop-select__value'>
            <Text className='desktop-select__text'>{displayLabel}</Text>
            <Text className={`desktop-select__arrow ${open ? 'desktop-select__arrow--open' : ''}`}>
              ▾
            </Text>
          </View>
        )}
      </View>
      {open && (
        <View className='desktop-select__dropdown'>
          {options.map((opt, index) => {
            const item = normalizeOption(opt, index)
            const isSelected = index === value
            return (
              <View
                key={index}
                className={`desktop-select__option ${isSelected ? 'desktop-select__option--selected' : ''}`}
                onClick={() => handleSelect(index)}
              >
                <Text className='desktop-select__option-label'>{item.label}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
