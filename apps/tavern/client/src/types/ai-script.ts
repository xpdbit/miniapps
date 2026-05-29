// ============================================================
// AI Script 客户端类型
// ============================================================

export type EventType =
  | 'character.move'
  | 'character.emote'
  | 'character.engage'
  | 'stat.modify'
  | 'stat.set'
  | 'world.advance_time'
  | 'world.set_weather'
  | 'world.announce'
  | 'inventory.add'
  | 'inventory.remove'
  | 'ui.notify'
  | 'ui.prompt'
  | 'dimension.modify'
  | 'kingdom.event'

export interface ScriptEvent {
  type: EventType
  payload: Record<string, unknown>
}

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

export interface WorldState {
  time: { hour: number; day: number; season: string }
  weather: string
  lastAnnounce?: string
}

export interface GameWorldState {
  scenarioId?: string
  dimensions: Record<string, number>
  world: WorldState
  characters: Record<string, CharacterState>
}
