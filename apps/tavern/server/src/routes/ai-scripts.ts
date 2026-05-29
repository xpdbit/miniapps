// ============================================================
// AI Script 管理路由
// 供 Dashboard 调用的管理接口
// ============================================================

import { Router, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { getAllTemplates, getTemplate } from '../services/ai-scripts/registry'
import { gameStateStore } from '../services/ai-scripts/game-state-store'
import { scenarioLoader } from '../services/ai-scripts/scenario-loader'
import { CharacterGenerator } from '../services/ai-scripts/character-generator'
import { parseEventLog } from '../services/ai-scripts/parser'
import { success } from '../utils/response'
import prisma from '../utils/prisma'

const router = Router()

/**
 * GET /ai-scripts/registry — 获取事件注册表
 */
router.get('/registry', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = getAllTemplates()
    res.json(success(templates))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * GET /ai-scripts/registry/:type — 获取单个事件模板
 */
router.get('/registry/:type', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const template = getTemplate(req.params.type)
    if (!template) {
      res.status(404).json({ code: 404, message: '事件类型不存在', data: null })
      return
    }
    res.json(success(template))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * GET /ai-scripts/state/:saveId — 获取游戏状态快照
 */
router.get('/state/:saveId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await gameStateStore.getState(req.params.saveId)
    if (!state) {
      res.status(404).json({ code: 404, message: '游戏状态不存在', data: null })
      return
    }
    res.json(success(state))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * PUT /ai-scripts/state/:saveId — 更新游戏状态（Dashboard 编辑用）
 */
router.put('/state/:saveId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { characters, world } = req.body
    const update: Record<string, unknown> = {}
    if (world !== undefined) update.world = world
    if (characters !== undefined) update.characters = characters
    await gameStateStore.setState(req.params.saveId, update)
    res.json(success({ message: '状态已更新' }))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * GET /ai-scripts/logs/:saveId — 获取事件日志（从 system 消息提取）
 */
router.get('/logs/:saveId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const offset = parseInt(req.query.offset as string) || 0

    const messages = await prisma.tavernChatMessage.findMany({
      where: { sessionId: req.params.saveId, role: 'system' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: { id: true, content: true, createdAt: true },
    })

    const logs = messages.map((msg) => ({
      id: msg.id,
      createdAt: msg.createdAt,
      events: parseEventLog(msg.content),
    }))

    res.json(success(logs))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

// ── Scenario 管理 ──────────────────────────────────────

/**
 * GET /scenarios — 获取所有剧本列表
 */
router.get('/scenarios', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const list = scenarioLoader.list()
    res.json(success(list))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * GET /scenarios/:id — 获取单个剧本完整内容
 */
router.get('/scenarios/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const scenario = scenarioLoader.get(req.params.id)
    if (!scenario) {
      res.status(404).json({ code: 404, message: '剧本不存在', data: null })
      return
    }
    res.json(success(scenario))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * POST /scenarios/:id/init — 初始化游戏（角色生成）
 */
router.post('/scenarios/:id/init', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scenario = scenarioLoader.get(req.params.id)
    if (!scenario) {
      res.status(404).json({ code: 404, message: '剧本不存在', data: null })
      return
    }

    // 角色生成（不含 AI 随机——随机角色使用 fallback）
    const generator = new CharacterGenerator()
    const characters = await generator.resolveAll(scenario.characters)

    const dimensions: Record<string, number> = {}
    for (const dim of scenario.world.dimensions) {
      dimensions[dim.key] = scenario.initialState.dimensions[dim.key]
        ?? Math.floor((dim.range[0] + dim.range[1]) / 2)
    }

    res.json(success({
      scenario: {
        meta: scenario.meta,
        world: scenario.world,
        rules: scenario.rules,
      },
      characters,
      initialState: {
        dimensions,
        time: scenario.initialState.time,
        weather: scenario.initialState.weather,
      },
      firstMessage: scenario.promptTemplate.firstMessage,
    }))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * POST /scenarios/validate — 校验 Scenario JSON
 */
router.post('/scenarios/validate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = scenarioLoader.validate(req.body)
    res.json(success(result))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * POST /scenarios — 创建/保存剧本
 */
router.post('/scenarios', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = scenarioLoader.validate(req.body)
    if (!result.valid) {
      res.status(400).json({ code: 400, message: '剧本配置不合法', errors: result.errors, data: null })
      return
    }
    scenarioLoader.save(req.body)
    res.json(success({ id: req.body.meta.id }))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * PUT /scenarios/:id — 更新剧本
 */
router.put('/scenarios/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = scenarioLoader.get(req.params.id)
    if (!existing) {
      res.status(404).json({ code: 404, message: '剧本不存在', data: null })
      return
    }
    const result = scenarioLoader.validate(req.body)
    if (!result.valid) {
      res.status(400).json({ code: 400, message: '剧本配置不合法', errors: result.errors, data: null })
      return
    }
    scenarioLoader.save(req.body)
    res.json(success({ id: req.body.meta.id }))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

/**
 * DELETE /scenarios/:id — 删除剧本
 */
router.delete('/scenarios/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = scenarioLoader.delete(req.params.id)
    if (!deleted) {
      res.status(400).json({ code: 400, message: '不能删除内置剧本', data: null })
      return
    }
    res.json(success('ok'))
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

export default router
