// ============================================================
// CharacterGenerator — 角色生成器
// 处理固定角色、N选1池、AI随机生成三种策略
// ============================================================

import type { CharacterState } from '@/types/ai-script'
import type { CharacterDef, FixedCharacter, PickOneCharacter, RandomCharacter } from '@/types/scenario'

export interface AiGenOptions {
  provider: string
  model: string
}

export interface AiProxyLike {
  generate(opts: {
    provider: string
    model: string
    messages: Array<{ role: string; content: string }>
    temperature?: number
    max_tokens?: number
  }): Promise<unknown>
}

export class CharacterGenerator {
  constructor(private aiProxy?: AiProxyLike) {}

  /** 解析单个角色定义 */
  async resolve(
    def: CharacterDef,
    options?: AiGenOptions,
  ): Promise<CharacterState | null> {
    switch (def.generation) {
      case 'fixed':
        return this.resolveFixed(def)
      case 'pick_one':
        return this.resolvePickOne(def)
      case 'random':
        return options && this.aiProxy ? this.resolveRandom(def, options) : null
      default:
        return null
    }
  }

  /** 解析所有角色 */
  async resolveAll(
    defs: CharacterDef[],
    options?: AiGenOptions,
  ): Promise<CharacterState[]> {
    const results: CharacterState[] = []
    for (const def of defs) {
      const char = await this.resolve(def, options)
      if (char) results.push(char)
    }
    return results
  }

  // ── 固定角色 ──
  private resolveFixed(def: FixedCharacter): CharacterState | null {
    if (def.spawnChance != null && Math.random() > def.spawnChance) return null
    return this.buildCharacter(
      def.id, def.name, def.location, def.role,
      def.initialStats, def.expertise, def.personality,
    )
  }

  // ── N选1 ──
  private resolvePickOne(def: PickOneCharacter): CharacterState {
    const chosen = def.pool[Math.floor(Math.random() * def.pool.length)]!
    return this.buildCharacter(
      def.id, chosen.name, chosen.location, chosen.role ?? 'npc',
      chosen.initialStats, chosen.expertise, chosen.personality,
    )
  }

  // ── AI随机生成 ──
  private async resolveRandom(
    def: RandomCharacter,
    options: AiGenOptions,
  ): Promise<CharacterState | null> {
    if (def.spawnChance != null && Math.random() > def.spawnChance) return null

    const { constraints } = def

    const prompt = [
      `在「${constraints.background}」背景下，创建一个角色。`,
      `身份：${constraints.roleHint}`,
      `性格方向：${constraints.personalityHint}`,
      constraints.traitPool?.length
        ? `从以下特质中选一个最合适的：${constraints.traitPool.join('、')}`
        : '',
    ].filter(Boolean).join(' ')

    try {
      if (!this.aiProxy) return this.buildFallback(def)

      const raw = await this.aiProxy.generate({
        provider: options.provider,
        model: options.model,
        messages: [
          {
            role: 'user',
            content: prompt + '\n只返回纯JSON，不要任何其他文字：\n{"name":"角色名","personality":"角色性格描述"}',
          },
        ],
        temperature: 0.9,
        max_tokens: 300,
      })

      const parsed = this.extractAiResponse(raw)
      const name = parsed?.name ?? constraints.roleHint
      const personality = parsed?.personality ?? constraints.personalityHint

      const expertise = constraints.expertisePool?.length
        ? constraints.expertisePool[Math.floor(Math.random() * constraints.expertisePool.length)]!
        : []

      const initialStats: Record<string, number> = {}
      if (constraints.initialStats) {
        for (const [key, [min, max]] of Object.entries(constraints.initialStats)) {
          initialStats[key] = Math.floor(Math.random() * (max - min + 1)) + min
        }
      }

      return this.buildCharacter(
        def.id, name, def.location, 'npc',
        initialStats, expertise, personality,
      )
    } catch (err) {
      console.warn(`[CharacterGenerator] AI generation failed for ${def.id}:`, (err as Error).message)
      return this.buildFallback(def)
    }
  }

  /** AI生成失败时的兜底 */
  private buildFallback(def: RandomCharacter): CharacterState {
    const expertise = def.constraints.expertisePool?.length
      ? def.constraints.expertisePool[0]!
      : []
    const initialStats: Record<string, number> = {}
    if (def.constraints.initialStats) {
      for (const [key, [min, max]] of Object.entries(def.constraints.initialStats)) {
        initialStats[key] = Math.floor((min + max) / 2)
      }
    }
    return this.buildCharacter(
      def.id, def.constraints.roleHint, def.location, 'npc',
      initialStats, expertise, def.constraints.personalityHint,
    )
  }

  // ── 构建 CharacterState ──
  private buildCharacter(
    id: string,
    name: string,
    location: string,
    role: string,
    initialStats?: Record<string, number>,
    expertise?: string[],
    personality?: string,
  ): CharacterState {
    return {
      id,
      name,
      location,
      mood: initialStats?.mood ?? 70,
      energy: initialStats?.energy ?? 75,
      health: initialStats?.health ?? 80,
      hunger: initialStats?.hunger ?? 65,
      stats: { ...initialStats ?? {} },
      inventory: [],
      flags: {
        role,
        expertise: expertise ?? [],
        personality: personality ?? '',
      },
    }
  }

  // ── 从 AI 回复中提取 JSON ──
  private extractAiResponse(raw: unknown): Record<string, unknown> | null {
    // 处理各种 AI 返回格式
    const text = (raw as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
      ?? (typeof raw === 'string' ? raw : JSON.stringify(raw))

    if (typeof text !== 'string') return null

    try { return JSON.parse(text) as Record<string, unknown> } catch { /* continue */ }
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
  }
}
