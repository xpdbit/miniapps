// ============================================================
// AI Script 事件处理器
// 每个事件类型对应一个 handler，直接修改 GameWorldState
// ============================================================

import type { GameWorldState } from '@/types/ai-script'

type EventHandler = (state: GameWorldState, payload: Record<string, unknown>) => void

/**
 * Clamp a number to [0, 100]
 */
function clampStat(v: number): number {
  return Math.max(0, Math.min(100, v))
}

/**
 * Get the season string from day number
 */
function getSeason(day: number): string {
  const seasonIndex = Math.floor(((day - 1) % 360) / 90)
  const seasons = ['spring', 'summer', 'autumn', 'winter']
  return seasons[seasonIndex] ?? 'spring'
}

/**
 * 确保角色存在（不存在则跳过）
 */
function getChar(state: GameWorldState, id: unknown): CharacterState | null {
  if (typeof id !== 'string') return null
  const char = state.characters[id]
  return char ?? null
}

// Need CharacterState type for handler
import type { CharacterState } from '@/types/ai-script'

export const EVENT_HANDLERS: Record<string, EventHandler> = {
  'character.move': (state, payload) => {
    const char = getChar(state, payload.characterId)
    if (!char || typeof payload.location !== 'string') return
    char.location = payload.location
  },

  'character.emote': (_state, _payload) => {
    // emote 事件不影响游戏状态，只用于表达
    // handler 为空操作
  },

  'character.engage': (state, payload) => {
    // engage 只验证两个角色存在，不做状态变更
    // 具体互动效果由 AI 在 narrative 中描述
    const from = getChar(state, payload.fromId)
    const to = getChar(state, payload.toId)
    if (!from || !to) return
    // 可选的后续扩展：跟踪角色关系
  },

  'stat.modify': (state, payload) => {
    const char = getChar(state, payload.targetId)
    if (!char || typeof payload.stat !== 'string' || typeof payload.delta !== 'number') return
    const validStats = ['mood', 'energy', 'health', 'hunger'] as const
    const statName = payload.stat
    if (!validStats.includes(statName as typeof validStats[number])) return
    const key = statName as keyof Pick<CharacterState, 'mood' | 'energy' | 'health' | 'hunger'>
    const current = char[key]
    if (typeof current !== 'number') return
    ;(char as unknown as Record<string, number>)[key] = clampStat(current + payload.delta)
  },

  'stat.set': (state, payload) => {
    const char = getChar(state, payload.targetId)
    if (!char || typeof payload.stat !== 'string' || typeof payload.value !== 'number') return
    const stat = payload.stat
    const knownKeys: Array<keyof CharacterState> = ['mood', 'energy', 'health', 'hunger']
    if (knownKeys.includes(stat as keyof CharacterState)) {
      ;(char as unknown as Record<string, number>)[stat] = clampStat(payload.value)
    } else {
      char.stats[stat] = payload.value
    }
  },

  'world.advance_time': (state, payload) => {
    const hours = typeof payload.hours === 'number' ? payload.hours : 1
    let newHour = state.world.time.hour + hours
    let newDay = state.world.time.day
    while (newHour >= 24) {
      newHour -= 24
      newDay += 1
    }
    state.world.time.hour = newHour
    state.world.time.day = newDay
    state.world.time.season = getSeason(newDay)
  },

  'world.set_weather': (state, payload) => {
    if (typeof payload.weather !== 'string') return
    state.world.weather = payload.weather
  },

  'world.announce': (state, payload) => {
    if (typeof payload.content !== 'string') return
    state.world.lastAnnounce = payload.content
  },

  'inventory.add': (state, payload) => {
    const char = getChar(state, payload.targetId)
    if (!char || typeof payload.itemId !== 'string') return
    const quantity = typeof payload.quantity === 'number' ? Math.max(1, Math.floor(payload.quantity)) : 1
    for (let i = 0; i < quantity; i++) {
      char.inventory.push(payload.itemId)
    }
  },

  'inventory.remove': (state, payload) => {
    const char = getChar(state, payload.targetId)
    if (!char || typeof payload.itemId !== 'string') return
    let remaining = typeof payload.quantity === 'number' ? Math.max(1, Math.floor(payload.quantity)) : 1
    char.inventory = char.inventory.filter((id) => {
      if (id === payload.itemId && remaining > 0) {
        remaining--
        return false
      }
      return true
    })
  },

  'ui.notify': (_state, _payload) => {
    // ui 事件透传给客户端，服务端不做状态变更
  },

  'ui.prompt': (_state, _payload) => {
    // ui.prompt 透传给客户端处理用户交互
  },

  // ── Scenario 维度控制 ──
  'dimension.modify': (state, payload) => {
    const { dimension, delta } = payload as { dimension: string; delta: number }
    if (typeof dimension !== 'string' || typeof delta !== 'number') return
    if (typeof state.dimensions[dimension] !== 'number') {
      state.dimensions[dimension] = 0
    }
    state.dimensions[dimension] = Math.max(0, Math.min(100,
      state.dimensions[dimension] + delta,
    ))
  },

  'kingdom.event': (_state, _payload) => {
    // 仅记录到事件日志，不做状态变更
    // 属性变化由配套的 dimension.modify 完成
  },
}

/**
 * 应用单个事件到游戏状态
 */
export function applyEvent(state: GameWorldState, event: { type: string; payload: Record<string, unknown> }): void {
  const handler = EVENT_HANDLERS[event.type]
  if (handler) {
    handler(state, event.payload)
  }
}

/**
 * 应用一批事件到游戏状态
 */
export function applyEvents(state: GameWorldState, events: Array<{ type: string; payload: Record<string, unknown> }>): void {
  for (const event of events) {
    applyEvent(state, event)
  }
}
