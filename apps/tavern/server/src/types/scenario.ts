// ============================================================
// Scenario（剧本）系统 - 类型定义
// 剧本 = 完整游戏玩法的 JSON 描述，含维度、事件、角色、Prompt、规则
// ============================================================

import type { ScriptTemplate } from './ai-script'

// ── 元信息 ──
export interface ScenarioMeta {
  id: string
  name: string
  description: string
  version: string
  author: string
  tags: string[]
}

// ── 世界配置 ──
export interface WorldConfig {
  dimensions: DimensionDef[]
  locations: string[]
  timeUnit: 'hour' | 'day' | 'month' | 'year'
}

export interface DimensionDef {
  key: string
  label: string
  icon?: string
  range: [number, number]
}

// ── 角色定义 ──
export type CharacterDef = FixedCharacter | PickOneCharacter | RandomCharacter

export interface FixedCharacter {
  id: string
  generation: 'fixed'
  name: string
  role: 'player' | 'npc'
  location: string
  personality: string
  expertise?: string[]
  initialStats?: Record<string, number>
  spawnChance?: number
  avatar?: string
}

export interface PickOneCharacter {
  id: string
  generation: 'pick_one'
  pool: Array<Omit<FixedCharacter, 'id' | 'generation'>>
}

export interface RandomCharacter {
  id: string
  generation: 'random'
  role: 'npc'
  location: string
  spawnChance?: number
  constraints: {
    background: string
    roleHint: string
    personalityHint: string
    traitPool?: string[]
    expertisePool?: string[][]
    initialStats?: Record<string, [number, number]>
  }
}

// ── 初始状态 ──
export interface ScenarioInitialState {
  dimensions: Record<string, number>
  time: { hour: number; day: number }
  weather: string
}

// ── 规则 ──
export interface ScenarioRules {
  loseCondition: string
  winCondition: string
  npcBehavior?: string
}

// ── Prompt 模板 ──
export interface ScenarioPrompt {
  system: string
  firstMessage: string
}

// ── 完整 Scenario ──
export interface Scenario {
  meta: ScenarioMeta
  world: WorldConfig
  events: ScriptTemplate[]
  customEvents: ScriptTemplate[]
  characters: CharacterDef[]
  initialState: ScenarioInitialState
  rules: ScenarioRules
  promptTemplate: ScenarioPrompt
}
