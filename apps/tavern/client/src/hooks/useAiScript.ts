// ============================================================
// useAiScript — AI Script 客户端响应 Hook
// 接收 SSE 中的 events 和 state，分发给游戏状态和 UI
// ============================================================

import { useCallback, useRef } from 'react'
import Taro from '@tarojs/taro'
import type { ScriptEvent, GameWorldState } from '@/types/ai-script'
import { useGameStore } from '@/stores/gameStore'

export interface AiScriptActions {
  /** 处理一批事件：更新游戏状态 + 触发 UI 反馈 */
  handleEvents: (events: ScriptEvent[]) => void
  /** 处理完整状态快照：同步到本地 */
  handleState: (state: GameWorldState) => void
  /** 获取当前状态（从本地缓存） */
  getLocalState: () => GameWorldState | null
}

const LOCAL_STATE_KEY = 'tavern_ai_script_state'

/** 双机制存储：优先 localStorage（H5），降级到 Taro API（小程序） */
function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch { /* ignore */ }
  try {
    const v = Taro.getStorageSync(key)
    return typeof v === 'string' ? v : v ? JSON.stringify(v) : null
  } catch { return null }
}

function storageSet(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
      return
    }
  } catch { /* ignore */ }
  try { Taro.setStorageSync(key, value) } catch { /* ignore */ }
}

function loadLocalState(): GameWorldState | null {
  try {
    const raw = storageGet(LOCAL_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GameWorldState
  } catch {
    return null
  }
}

function saveLocalState(state: GameWorldState): void {
  try {
    storageSet(LOCAL_STATE_KEY, state)
  } catch {
    // ignore storage errors
  }
}

/**
 * 通过 gameStore 的 activeSave 中的角色 ID 列表初始化状态
 */
function deriveInitialState(): GameWorldState | null {
  const save = useGameStore.getState().activeSave()
  if (!save) return null

  const characters: Record<string, GameWorldState['characters'][string]> = {}
  for (const group of save.groups) {
    for (const memberId of group.memberIds) {
      if (!characters[memberId]) {
        characters[memberId] = {
          id: memberId,
          name: memberId,
          location: '酒馆',
          mood: 75,
          energy: 80,
          health: 90,
          hunger: 70,
          stats: {},
          inventory: [],
          flags: {},
        }
      }
    }
  }

  return {
    world: {
      time: { hour: 8, day: 1, season: 'spring' },
      weather: 'sunny',
    },
    characters,
  }
}

/**
 * Apply events to a local state snapshot
 */
function applyEventsToState(state: GameWorldState, events: ScriptEvent[]): void {
  for (const event of events) {
    const { payload } = event
    switch (event.type) {
      case 'character.move': {
        const ch = state.characters[payload.characterId as string]
        if (ch && typeof payload.location === 'string') ch.location = payload.location
        break
      }
      case 'stat.modify': {
        const ch = state.characters[payload.targetId as string]
        if (ch && typeof payload.stat === 'string' && typeof payload.delta === 'number') {
          const key = ['mood', 'energy', 'health', 'hunger'].includes(payload.stat)
            ? (payload.stat as 'mood' | 'energy' | 'health' | 'hunger')
            : null
          if (key && typeof ch[key] === 'number') {
            ch[key] = Math.max(0, Math.min(100, ch[key] + payload.delta))
          }
        }
        break
      }
      case 'stat.set': {
        const ch = state.characters[payload.targetId as string]
        if (ch && typeof payload.stat === 'string' && typeof payload.value === 'number') {
          const key = ['mood', 'energy', 'health', 'hunger'].includes(payload.stat)
            ? (payload.stat as 'mood' | 'energy' | 'health' | 'hunger')
            : null
          if (key) {
            ch[key] = Math.max(0, Math.min(100, payload.value))
          } else {
            ch.stats[payload.stat] = payload.value
          }
        }
        break
      }
      case 'world.advance_time': {
        const hours = typeof payload.hours === 'number' ? payload.hours : 1
        let newHour = state.world.time.hour + hours
        let newDay = state.world.time.day
        while (newHour >= 24) { newHour -= 24; newDay += 1 }
        state.world.time.hour = newHour
        state.world.time.day = newDay
        break
      }
      case 'world.set_weather': {
        if (typeof payload.weather === 'string') state.world.weather = payload.weather
        break
      }
      case 'world.announce': {
        if (typeof payload.content === 'string') state.world.lastAnnounce = payload.content
        break
      }
      case 'inventory.add': {
        const ch = state.characters[payload.targetId as string]
        if (ch && typeof payload.itemId === 'string') {
          const qty = typeof payload.quantity === 'number' ? Math.max(1, Math.floor(payload.quantity)) : 1
          for (let i = 0; i < qty; i++) ch.inventory.push(payload.itemId)
        }
        break
      }
      case 'inventory.remove': {
        const ch = state.characters[payload.targetId as string]
        if (ch && typeof payload.itemId === 'string') {
          let remaining = typeof payload.quantity === 'number' ? Math.max(1, Math.floor(payload.quantity)) : 1
          ch.inventory = ch.inventory.filter((id: string) => {
            if (id === payload.itemId && remaining > 0) { remaining--; return false }
            return true
          })
        }
        break
      }
      case 'ui.notify': {
        const type = (payload.type as string) || 'none'
        const content = (payload.content as string) || ''
        Taro.showToast({ title: content, icon: type === 'warning' ? 'none' : 'success', duration: 2000 })
        break
      }
      // ui.prompt is handled separately (requires user interaction)
      case 'ui.prompt':
      case 'character.emote':
      case 'character.engage':
        // These are narrative-only or interactive events handled at a higher level
        break
    }
  }
}

export function useAiScript(): AiScriptActions {
  const stateRef = useRef<GameWorldState | null>(loadLocalState())

  const handleEvents = useCallback((events: ScriptEvent[]) => {
    // Load or initialize local state
    let state = stateRef.current
    if (!state) {
      state = deriveInitialState()
      if (!state) return
      stateRef.current = state
    }

    // Apply events
    applyEventsToState(state, events)
    saveLocalState(state)

    // Broadcast events for UI components (map, status bars, etc.)
    Taro.eventCenter.trigger('ai-script:events', events)
  }, [])

  const handleState = useCallback((state: GameWorldState) => {
    stateRef.current = state
    saveLocalState(state)
    Taro.eventCenter.trigger('ai-script:state', state)
  }, [])

  const getLocalState = useCallback((): GameWorldState | null => {
    return stateRef.current
  }, [])

  return { handleEvents, handleState, getLocalState }
}

export type { ScriptEvent, GameWorldState }
