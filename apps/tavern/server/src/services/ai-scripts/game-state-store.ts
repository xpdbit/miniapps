// ============================================================
// GameStateStore — 游戏状态运行时
// 内存存储，按 saveId 维护 GameWorldState 实例
// 重启时从 ChatMessage (role=system) 记录的事件溯源重建
// ============================================================

import type { GameWorldState, CharacterState, ScriptEvent, CharacterStateInput } from '@/types/ai-script'
import type { Scenario } from '@/types/scenario'
import { applyEvents } from './handlers'
import { parseEventLog } from './parser'
import prisma from '@/utils/prisma'

/**
 * 创建默认的世界状态
 */
function createDefaultWorldState(): GameWorldState['world'] {
  return {
    time: { hour: 8, day: 1, season: 'spring' },
    weather: 'sunny',
  }
}

/**
 * 创建默认的角色状态
 */
function createDefaultCharacter(id: string, name: string): CharacterState {
  return {
    id,
    name,
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

/**
 * 从 ChatMessage 记录中回放事件重建状态
 */
async function rebuildStateFromHistory(
  saveId: string,
  characters: CharacterStateInput[],
): Promise<GameWorldState> {
  const state: GameWorldState = {
    dimensions: {},
    world: createDefaultWorldState(),
    characters: {},
  }

  // 初始化角色
  for (const c of characters) {
    state.characters[c.id] = {
      ...createDefaultCharacter(c.id, c.name),
      location: c.location ?? '酒馆',
      mood: c.mood ?? 75,
      energy: c.energy ?? 80,
      health: c.health ?? 90,
      hunger: c.hunger ?? 70,
      stats: c.stats ?? {},
      inventory: c.inventory ?? [],
      flags: c.flags ?? {},
    }
  }

  // 回放事件
  try {
    const eventMessages = await prisma.tavernChatMessage.findMany({
      where: { sessionId: saveId, role: 'system' },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    })

    for (const msg of eventMessages) {
      const events = parseEventLog(msg.content)
      applyEvents(state, events)
    }
  } catch {
    // DB 不可用时仅返回初始状态
  }

  return state
}

export class GameStateStore {
  /**
   * saveId → GameWorldState
   */
  private cache: Map<string, GameWorldState> = new Map()

  /**
   * 获取或初始化游戏状态
   */
  async getOrInit(saveId: string, characters?: CharacterStateInput[]): Promise<GameWorldState> {
    const cached = this.cache.get(saveId)
    if (cached) return cached

    const state = await rebuildStateFromHistory(saveId, characters ?? [])
    this.cache.set(saveId, state)
    return state
  }

  /**
   * 获取已有状态（不自动初始化）
   */
  async getState(saveId: string): Promise<GameWorldState | null> {
    const cached = this.cache.get(saveId)
    if (cached) return cached

    // 尝试从 DB 重建
    try {
      const state = await rebuildStateFromHistory(saveId, [])
      if (state) {
        this.cache.set(saveId, state)
        return state
      }
    } catch {
      return null
    }

    return null
  }

  /**
   * 应用一批事件到指定 saveId 的状态
   */
  async applyEvents(saveId: string, events: ScriptEvent[]): Promise<void> {
    const state = await this.getOrInit(saveId)
    applyEvents(state, events)
    // 更新缓存
    this.cache.set(saveId, state)
  }

  /**
   * Dashboard 手动或 AI 更新状态
   */
  async setState(saveId: string, partial: Partial<GameWorldState>): Promise<void> {
    const state = await this.getOrInit(saveId)
    if (partial.world) {
      state.world = { ...state.world, ...partial.world }
    }
    if (partial.characters) {
      for (const [id, charData] of Object.entries(partial.characters)) {
        if (state.characters[id]) {
          state.characters[id] = { ...state.characters[id]!, ...charData }
        } else {
          state.characters[id] = createDefaultCharacter(id, charData?.name ?? id)
        }
      }
    }
    this.cache.set(saveId, state)
  }

  /**
   * 设置角色列表（首次初始化用）
   */
  async initCharacters(saveId: string, characters: CharacterStateInput[]): Promise<void> {
    const state = await this.getOrInit(saveId, characters)
    this.cache.set(saveId, state)
  }

  /**
   * 从 Scenario 初始化游戏状态
   */
  async initFromScenario(
    saveId: string,
    scenario: Scenario,
    characters: CharacterState[],
  ): Promise<GameWorldState> {
    const dimensions: Record<string, number> = {}
    for (const dim of scenario.world.dimensions) {
      dimensions[dim.key] = scenario.initialState.dimensions[dim.key]
        ?? Math.floor((dim.range[0] + dim.range[1]) / 2)
    }

    const state: GameWorldState = {
      scenarioId: scenario.meta.id,
      dimensions,
      world: {
        time: {
          hour: scenario.initialState.time.hour,
          day: scenario.initialState.time.day,
          season: 'spring',
        },
        weather: scenario.initialState.weather,
      },
      characters: {},
    }

    for (const char of characters) {
      state.characters[char.id] = {
        ...char,
        stats: { ...char.stats },
        inventory: [...char.inventory],
        flags: { ...char.flags },
      }
    }

    this.cache.set(saveId, state)
    return state
  }

  /**
   * 清除缓存的指定 saveId 状态
   */
  invalidate(saveId: string): void {
    this.cache.delete(saveId)
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear()
  }
}

/** 全局单例 */
export const gameStateStore = new GameStateStore()
