// ============================================================
// ScenarioLoader — 剧本加载器
// 启动时扫描 scenarios/builtin/ + scenarios/custom/
// 提供 CRUD 和校验能力
// ============================================================

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Scenario } from '@/types/scenario'

const SCENARIOS_DIR = path.resolve(process.cwd(), 'scenarios')

export interface ScenarioSummary {
  id: string
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  dimensionCount: number
  characterCount: number
  source: 'builtin' | 'custom'
}

export class ScenarioLoader {
  private scenarios: Map<string, Scenario> = new Map()
  private initialized = false

  /** 启动时扫描 scenarios/ 目录 */
  loadAll(): void {
    this.scenarios.clear()
    for (const source of ['builtin', 'custom'] as const) {
      const dir = path.join(SCENARIOS_DIR, source)
      if (!fs.existsSync(dir)) continue

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.scenario.json'))
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
          const scenario = JSON.parse(raw) as Scenario
          this.scenarios.set(scenario.meta.id, scenario)
        } catch (err) {
          console.warn(`[ScenarioLoader] Failed to load ${file}:`, (err as Error).message)
        }
      }
    }
    this.initialized = true
    console.log(`[ScenarioLoader] Loaded ${this.scenarios.size} scenarios`)
  }

  /** 确保已初始化 */
  private ensureLoaded(): void {
    if (!this.initialized) this.loadAll()
  }

  /** 获取所有剧本摘要（列表用） */
  list(): ScenarioSummary[] {
    this.ensureLoaded()
    return Array.from(this.scenarios.values()).map(s => ({
      id: s.meta.id,
      name: s.meta.name,
      description: s.meta.description,
      version: s.meta.version,
      author: s.meta.author,
      tags: s.meta.tags,
      dimensionCount: s.world.dimensions.length,
      characterCount: s.characters.length,
      source: this.isBuiltin(s.meta.id) ? 'builtin' : 'custom',
    }))
  }

  /** 按 ID 获取完整 Scenario */
  get(id: string): Scenario | undefined {
    this.ensureLoaded()
    return this.scenarios.get(id)
  }

  /** 保存自定义 Scenario（写入 custom 目录） */
  save(scenario: Scenario): void {
    this.scenarios.set(scenario.meta.id, scenario)
    const dir = path.join(SCENARIOS_DIR, 'custom')
    fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${scenario.meta.id}.scenario.json`)
    fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2), 'utf-8')
    console.log(`[ScenarioLoader] Saved scenario: ${scenario.meta.id}`)
  }

  /** 删除自定义 Scenario */
  delete(id: string): boolean {
    if (this.isBuiltin(id)) return false
    this.scenarios.delete(id)
    const filePath = path.join(SCENARIOS_DIR, 'custom', `${id}.scenario.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  }

  /** 校验 Scenario JSON schema */
  validate(scenario: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const s = scenario as Scenario

    if (!s?.meta?.id || !/^[a-z0-9-]{3,50}$/.test(s.meta.id)) {
      errors.push('meta.id: 必填，3-50 字符，仅小写字母数字连字符')
    }
    if (!s?.meta?.name) errors.push('meta.name: 必填')
    if (!s?.world?.dimensions?.length) errors.push('world.dimensions: 至少 1 个维度')
    if (s?.world?.dimensions) {
      const keys = new Set<string>()
      for (const d of s.world.dimensions) {
        if (!d.key) { errors.push(`维度缺少 key`); continue }
        if (keys.has(d.key)) errors.push(`维度 key 重复: ${d.key}`)
        keys.add(d.key)
        if (d.range && d.range[0] >= d.range[1]) errors.push(`维度 ${d.key} range 无效`)
      }
    }
    if (!s?.characters?.length) errors.push('characters: 至少 1 个角色')
    if (s?.characters?.length && !s.characters.some((c) => {
      const def = c as { role?: string }
      return def.role === 'player'
    })) {
      errors.push('characters: 至少 1 个 player 角色')
    }
    if (!s?.promptTemplate?.system) errors.push('promptTemplate.system: 必填')
    if (!s?.promptTemplate?.firstMessage) errors.push('promptTemplate.firstMessage: 必填')
    if (s?.promptTemplate?.system && !s.promptTemplate.system.includes('{character.name}')) {
      errors.push('promptTemplate.system 必须包含 {character.name} 占位符')
    }
    if (s?.events) {
      const eventTypes = new Set<string>()
      for (const e of s.events) {
        if (eventTypes.has(e.type)) errors.push(`事件 type 重复: ${e.type}`)
        eventTypes.add(e.type)
      }
    }
    if (s?.initialState?.dimensions && s?.world?.dimensions) {
      const dimKeys = new Set(s.world.dimensions.map(d => d.key))
      for (const key of Object.keys(s.initialState.dimensions)) {
        if (!dimKeys.has(key)) errors.push(`initialState 含未定义维度: ${key}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /** 判断是否内置剧本 */
  private isBuiltin(id: string): boolean {
    return fs.existsSync(path.join(SCENARIOS_DIR, 'builtin', `${id}.scenario.json`))
  }
}

export const scenarioLoader = new ScenarioLoader()
