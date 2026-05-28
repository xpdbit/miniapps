// ============================================================
// AI Script 系统 - 核心类型定义
// ============================================================

/**
 * 可用事件类型枚举
 */
export const EVENT_TYPES = [
  // 角色控制
  'character.move',
  'character.emote',
  'character.engage',
  // 状态修改
  'stat.modify',
  'stat.set',
  // 世界控制
  'world.advance_time',
  'world.set_weather',
  'world.announce',
  // 物品系统
  'inventory.add',
  'inventory.remove',
  // 交互反馈
  'ui.notify',
  'ui.prompt',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

/**
 * 单个 AI Script 事件
 */
export interface ScriptEvent {
  type: EventType
  payload: Record<string, unknown>
}

/**
 * AI 回复的完整结构
 */
export interface AiScriptResponse {
  narrative: string
  events: ScriptEvent[]
}

/**
 * 游戏世界状态
 */
export interface GameWorldState {
  world: WorldState
  characters: Record<string, CharacterState>
}

/**
 * 世界状态
 */
export interface WorldState {
  time: {
    hour: number
    day: number
    season: string
  }
  weather: string
  lastAnnounce?: string
}

/**
 * 角色状态
 */
export interface CharacterState {
  id: string
  name: string
  location: string
  mood: number
  energy: number
  health: number
  hunger: number
  stats: Record<string, number>
  inventory: string[]
  flags: Record<string, unknown>
}

/**
 * 事件模板（注册表中维护）
 */
export interface ScriptTemplate {
  type: EventType
  description: string
  parameters: Record<string, ScriptParamDef>
}

export interface ScriptParamDef {
  type: 'string' | 'number' | 'boolean'
  description: string
  enum?: string[]
  required?: boolean
}

/**
 * 可序列化的角色状态（用于 Dashboard 编辑）
 */
export type CharacterStateInput = Omit<CharacterState, 'stats' | 'inventory' | 'flags'> & {
  stats?: Record<string, number>
  inventory?: string[]
  flags?: Record<string, unknown>
}
