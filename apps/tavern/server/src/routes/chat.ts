import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { buildPrompt, buildChoicePrompt } from '../services/prompt-builder.service'
import { routeChat, sanitizeAiText, generateChoices } from '../services/ai-proxy.service'
import * as contextService from '../services/context.service'
import { parseAiScriptResponse, serializeEventLog, gameStateStore } from '../services/ai-scripts'
import { scenarioLoader } from '../services/ai-scripts/scenario-loader'
import type { Scenario } from '../types/scenario'
import prisma from '../utils/prisma'

const router = Router()

const sendSchema = z.object({
  sessionId: z.string().optional(),
  characterId: z.string(),
  personaId: z.string().optional(),
  message: z.string().min(1).max(2000),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  cardData: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    prompt: z.string().optional(),
  }).optional(),
  // AI Script 游戏模式支持
  saveId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
  scenarioId: z.string().optional(),
  // 用户角色化身
  userPersonaId: z.string().optional(),
  // 请求 AI 在回复后生成行动选项
  requestChoice: z.boolean().optional(),
})

// POST /api/v1/chat/send - SSE streaming chat
router.post('/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const params = sendSchema.parse(req.body)
    const userId = req.user!.userId

    let session
    if (params.sessionId) {
      session = await contextService.getSession(params.sessionId, userId)
      if (!session) {
        sendEvent({ type: 'error', code: 'SESSION_NOT_FOUND', message: '会话不存在' })
        res.end()
        return
      }
    } else {
      session = await contextService.createSession({
        userId,
        characterId: params.characterId,
        personaId: params.personaId,
        modelKey: params.model,
        temperature: params.temperature,
      })
    }

    sendEvent({ type: 'meta', sessionId: session.id, characterId: params.characterId })

    let character: {
      name: string; description: string; prompt?: string | null
    } | null = null

    if (params.cardData) {
      character = {
        name: params.cardData.name || '',
        description: params.cardData.description || '',
        prompt: params.cardData.prompt || null,
      }
    } else if (params.sessionId) {
      const s = session as { character?: { name: string; description: string; prompt?: string | null } | null }
      character = s.character ?? null
    } else {
      character = await prisma.tavernCard.findUnique({
        where: { id: params.characterId },
        select: { name: true, description: true, prompt: true },
      })
    }

    if (!character) {
      sendEvent({ type: 'error', code: 'CHARACTER_NOT_FOUND', message: '角色不存在' })
      res.end()
      return
    }

    let persona = null
    if (params.personaId) {
      persona = await prisma.tavernPersona.findUnique({ where: { id: params.personaId } })
    }
    // Load user's game persona (their character in the world)
    let userPersona = null
    if (params.userPersonaId) {
      userPersona = await prisma.tavernPersona.findUnique({ where: { id: params.userPersonaId } })
    }

    let history: Array<{ role: string; content: string }> = []
    if (params.sessionId) {
      const sessionWithMsgs = session as { messages?: { role: string; content: string }[] }
      history = (sessionWithMsgs.messages ?? []).map(m => ({ role: m.role, content: m.content }))
    }

    // AI Script: load game state if in game mode
    const hasGameMode = !!(params.saveId && params.characterIds?.length)
    let gameState = null
    let scenario: Scenario | null = null

    if (hasGameMode && params.scenarioId) {
      // Scenario-driven mode
      scenario = scenarioLoader.get(params.scenarioId) ?? null
      if (scenario) {
        gameState = await gameStateStore.getState(params.saveId!)
        if (!gameState) {
          // Lazy init: use default characters
          const defaultChars: Array<{ id: string; name: string; location: string; mood: number; energy: number; health: number; hunger: number }> = params.characterIds!.map((id) => ({
            id,
            name: id,
            location: '酒馆',
            mood: 75,
            energy: 80,
            health: 90,
            hunger: 70,
          }))
          gameState = await gameStateStore.initFromScenario(
            params.saveId!,
            scenario,
            defaultChars.map(c => ({
              ...c,
              stats: {},
              inventory: [],
              flags: { role: 'npc' },
            })),
          )
        }
        // Ensure current character exists
        if (!gameState.characters[params.characterId]) {
          gameState.characters[params.characterId] = {
            id: params.characterId,
            name: character.name,
            location: '酒馆',
            mood: 75,
            energy: 80,
            health: 90,
            hunger: 70,
            stats: {},
            inventory: [],
            flags: { role: 'npc' },
          }
        }
      }
    } else if (hasGameMode) {
      // Legacy game mode (without scenario)
      const characters = params.characterIds!.map((id) => ({
        id,
        name: id,
        location: '酒馆',
        mood: 75,
        energy: 80,
        health: 90,
        hunger: 70,
      }))
      gameState = await gameStateStore.getOrInit(params.saveId!, characters)
      if (gameState && !gameState.characters[params.characterId]) {
        gameState.characters[params.characterId] = {
          id: params.characterId,
          name: character.name,
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

    const prompt = buildPrompt({
      character: {
        name: character.name,
        description: character.description,
        prompt: character.prompt,
      },
      characterId: params.characterId,
      persona: persona ? { name: persona.name, description: persona.description } : null,
      history,
      currentMessage: params.message,
      gameState,
      scenario,
      scenarioCharacterId: scenario ? params.characterId : undefined,
    })

    await contextService.saveMessage(session.id, 'user', sanitizeAiText(params.message), 0, true)

    // Client disconnect handler
    let fullResponse = ''
    let aborted = false
    req.on('close', () => {
      if (!aborted && !res.writableEnded) {
        aborted = true
      }
    })

    await routeChat({
      userId,
      messages: prompt.messages,
      model: params.model,
      temperature: params.temperature,
      onToken: (token: string) => {
        if (aborted) return
        const sanitized = sanitizeAiText(token)
        fullResponse += sanitized
        if (sanitized && !res.writableEnded) {
          sendEvent({ type: 'token', content: sanitized })
        }
      },
      onDone: async (result) => {
        if (aborted) return
        if (!fullResponse.trim()) {
          await prisma.tavernChatSession.update({
            where: { id: session.id },
            data: { messageCount: { increment: 1 } },
          })
          if (!res.writableEnded) {
            sendEvent({ type: 'error', code: 'AI_ERROR', message: 'AI 返回了空响应' })
            res.end()
          }
          return
        }

        // AI Script: parse and execute events from AI response
        const parsed = parseAiScriptResponse(fullResponse)
        fullResponse = parsed.narrative

        const msg = await contextService.saveMessage(session.id, 'character', fullResponse, result.tokens, true)
        await prisma.tavernChatSession.update({
          where: { id: session.id },
          data: {
            messageCount: { increment: 2 },
            tokenCount: { increment: result.tokens ?? 0 },
          },
        })

        // AI Script: execute events and persist as system messages
        if (hasGameMode && parsed.events.length > 0) {
          await gameStateStore.applyEvents(params.saveId!, parsed.events)
          const eventLog = serializeEventLog(parsed.events)
          await contextService.saveMessage(session.id, 'system', eventLog, 0, true)
        }

        if (!res.writableEnded) {
          sendEvent({ type: 'done', sessionId: session.id, messageId: msg.id, tokens: result.tokens })
        }

        // AI Script: send events + state to client
        if (hasGameMode && parsed.events.length > 0) {
          sendEvent({ type: 'events', events: parsed.events })
          const updatedState = await gameStateStore.getState(params.saveId!)
          if (updatedState) {
            sendEvent({ type: 'state', state: updatedState })
          }
        }

        // Choice generation: if requestChoice, generate action options for the player
        if (params.requestChoice && hasGameMode) {
          try {
            const personaName = userPersona?.name ?? '冒险者'
            const personaDesc = userPersona?.description ?? null
            const choicePrompt = buildChoicePrompt({
              personaName,
              personaDescription: personaDesc,
              lastNarrative: fullResponse,
            })
            const choiceResult = await generateChoices({
              userId,
              choicePrompt,
              model: params.model,
            })
            if (!res.writableEnded) {
              sendEvent({
                type: 'choice',
                summary: choiceResult.summary,
                choices: choiceResult.choices,
              })
            }
          } catch (choiceErr) {
            // Choice generation failed — silently continue, client falls back to free input
            console.warn('[chat] choice generation failed:', choiceErr)
          }
        }

        if (!params.cardData) {
          await prisma.tavernCard.update({
            where: { id: params.characterId },
            data: { chatCount: { increment: 1 } },
          }).catch(() => {})
        }

        res.end()
      },
      onError: (err: Error) => {
        prisma.tavernChatSession.update({
          where: { id: session.id },
          data: { messageCount: { increment: 1 } },
        }).catch(() => {})
        if (!res.writableEnded) {
          if (err.message === 'QUOTA_EXCEEDED') {
            sendEvent({ type: 'error', code: 'QUOTA_EXCEEDED', message: '今日免费额度已用完' })
          } else if (err.message === 'KEY_MISSING') {
            sendEvent({ type: 'error', code: 'KEY_MISSING', message: '未配置 API Key' })
          } else {
            sendEvent({ type: 'error', code: 'AI_ERROR', message: 'AI 服务暂时不可用' })
          }
          res.end()
        }
      },
    })
  } catch (err: unknown) {
    if (!res.writableEnded) {
      if (err instanceof z.ZodError) {
        sendEvent({ type: 'error', code: 'INVALID_PARAMS', message: '参数错误' })
      } else {
        sendEvent({ type: 'error', code: 'SERVER_ERROR', message: '服务器内部错误' })
      }
      res.end()
    }
  }
})

// ─── Session Management ────────────────────────────────────────────

router.get('/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const result = await contextService.getMySessions(req.user!.userId, page, pageSize)
    res.json({ code: 0, message: 'ok', data: result })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

router.get('/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await contextService.getSession(req.params.id, req.user!.userId)
    if (!session) {
      res.status(404).json({ code: 404, message: '会话不存在', data: null })
      return
    }
    res.json({ code: 0, message: 'ok', data: session })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

router.delete('/sessions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await contextService.deleteSession(req.params.id, req.user!.userId)
    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      res.status(403).json({ code: 403, message: '无权操作', data: null })
    } else {
      res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
    }
  }
})

// ─── Search ────────────────────────────────────────────────────────

router.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim()
    if (!q || q.length < 1) {
      res.json({ code: 0, data: { items: [], total: 0 }, message: 'ok' })
      return
    }

    const userId = req.user!.userId
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const skip = (page - 1) * pageSize

    const [items, total] = await Promise.all([
      prisma.tavernChatMessage.findMany({
        where: {
          session: { userUuid: userId },
          content: { contains: q },
        },
        include: {
          session: {
            select: { id: true, cardId: true, character: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.tavernChatMessage.count({
        where: {
          session: { userUuid: userId },
          content: { contains: q },
        },
      }),
    ])

    res.json({
      code: 0,
      data: {
        items: items.map(m => ({
          id: m.id,
          sessionId: m.sessionId,
          characterName: m.session.character?.name || '未知角色',
          role: m.role,
          content: m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content,
          createdAt: m.createdAt,
        })),
        total,
        page,
        pageSize,
      },
      message: 'ok',
    })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

// ─── Message CRUD ──────────────────────────────────────────────────

const editMessageSchema = z.object({
  content: z.string().min(1).max(2000),
})

router.put('/sessions/:sessionId/messages/:messageId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content } = editMessageSchema.parse(req.body)
    const userId = req.user!.userId

    const session = await contextService.getSession(req.params.sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 404, message: '会话不存在', data: null })
      return
    }

    const message = await prisma.tavernChatMessage.findUnique({ where: { id: req.params.messageId } })
    if (!message || message.sessionId !== req.params.sessionId) {
      res.status(404).json({ code: 404, message: '消息不存在', data: null })
      return
    }

    if (message.role !== 'user') {
      res.status(403).json({ code: 403, message: '只能编辑自己发送的消息', data: null })
      return
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    if (message.createdAt < fiveMinAgo) {
      res.status(400).json({ code: 400, message: '消息发送超过5分钟，无法编辑', data: null })
      return
    }

    const updated = await prisma.tavernChatMessage.update({
      where: { id: req.params.messageId },
      data: { content: sanitizeAiText(content) },
    })

    res.json({ code: 0, message: 'ok', data: updated })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ code: 400, message: '参数错误', data: err.errors })
      return
    }
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

router.delete('/sessions/:sessionId/messages/:messageId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const session = await contextService.getSession(req.params.sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 404, message: '会话不存在', data: null })
      return
    }

    const message = await prisma.tavernChatMessage.findUnique({ where: { id: req.params.messageId } })
    if (!message || message.sessionId !== req.params.sessionId) {
      res.status(404).json({ code: 404, message: '消息不存在', data: null })
      return
    }

    if (message.role !== 'user') {
      res.status(403).json({ code: 403, message: '只能删除自己发送的消息', data: null })
      return
    }

    await prisma.tavernChatMessage.update({
      where: { id: req.params.messageId },
      data: { content: '[消息已删除]' },
    })

    res.json({ code: 0, message: 'ok', data: null })
  } catch (err: unknown) {
    res.status(500).json({ code: 500, message: err instanceof Error ? err.message : 'Unknown error', data: null })
  }
})

// ─── Regenerate ────────────────────────────────────────────────────

router.post('/sessions/:sessionId/regenerate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const userId = req.user!.userId
    const session = await contextService.getSession(req.params.sessionId, userId)
    if (!session) {
      sendEvent({ type: 'error', code: 'SESSION_NOT_FOUND', message: '会话不存在' })
      res.end()
      return
    }

    const lastAssistantMsg = await prisma.tavernChatMessage.findFirst({
      where: { sessionId: session.id, role: 'character' },
      orderBy: { createdAt: 'desc' },
    })

    if (!lastAssistantMsg) {
      sendEvent({ type: 'error', code: 'NO_AI_MESSAGE', message: '没有可重新生成的 AI 回复' })
      res.end()
      return
    }

    await prisma.tavernChatMessage.delete({ where: { id: lastAssistantMsg.id } })

    const history = await prisma.tavernChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })

    const lastUserMsg = history.filter(m => m.role === 'user').pop()
    if (!lastUserMsg) {
      sendEvent({ type: 'error', code: 'NO_USER_MESSAGE', message: '没有可重新生成的消息' })
      res.end()
      return
    }

    const s = session as { character?: { name: string; description: string; prompt?: string | null } | null }
    const character = s.character ?? null
    if (!character) {
      sendEvent({ type: 'error', code: 'CHARACTER_NOT_FOUND', message: '角色不存在' })
      res.end()
      return
    }

    const historyBeforeLast = history.slice(0, -1)
    const prompt = buildPrompt({
      character: {
        name: character.name,
        description: character.description,
        prompt: character.prompt ?? undefined,
      },
      persona: null,
      history: historyBeforeLast.map(m => ({ role: m.role, content: m.content })),
      currentMessage: lastUserMsg.content,
    })

    sendEvent({ type: 'meta', sessionId: session.id, characterId: session.cardId })

    let fullResponse = ''
    let aborted = false
    req.on('close', () => {
      if (!aborted && !res.writableEnded) {
        aborted = true
      }
    })

    await routeChat({
      userId,
      messages: prompt.messages,
      model: req.body.model || undefined,
      temperature: req.body.temperature ?? undefined,
      onToken: (token: string) => {
        if (aborted) return
        const sanitized = sanitizeAiText(token)
        fullResponse += sanitized
        if (sanitized && !res.writableEnded) {
          sendEvent({ type: 'token', content: sanitized })
        }
      },
      onDone: async (result) => {
        if (aborted) return
        if (!fullResponse.trim()) {
          if (!res.writableEnded) {
            sendEvent({ type: 'error', code: 'AI_ERROR', message: 'AI 返回了空响应' })
            res.end()
          }
          return
        }
        const msg = await contextService.saveMessage(session.id, 'character', fullResponse, result.tokens, true)
        if (!res.writableEnded) {
          sendEvent({ type: 'done', sessionId: session.id, messageId: msg.id, tokens: result.tokens })
        }
        res.end()
      },
      onError: (err: Error) => {
        if (!res.writableEnded) {
          if (err.message === 'QUOTA_EXCEEDED') {
            sendEvent({ type: 'error', code: 'QUOTA_EXCEEDED', message: '今日免费额度已用完' })
          } else if (err.message === 'KEY_MISSING') {
            sendEvent({ type: 'error', code: 'KEY_MISSING', message: '未配置 API Key' })
          } else {
            sendEvent({ type: 'error', code: 'AI_ERROR', message: 'AI 服务暂时不可用' })
          }
          res.end()
        }
      },
    })
  } catch (err: unknown) {
    if (!res.writableEnded) {
      if (err instanceof z.ZodError) {
        sendEvent({ type: 'error', code: 'INVALID_PARAMS', message: '参数错误' })
      } else {
        sendEvent({ type: 'error', code: 'SERVER_ERROR', message: '服务器内部错误' })
      }
      res.end()
    }
  }
})

export default router
