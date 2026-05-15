import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { buildPrompt } from '../services/prompt-builder.service'
import { routeChat } from '../services/ai-proxy.service'
import * as contextService from '../services/context.service'
import prisma from '../utils/prisma'

const router = Router()

const sendSchema = z.object({
  sessionId: z.string().optional(),
  characterId: z.string(),
  personaId: z.string().optional(),
  message: z.string().min(1).max(2000),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
})

// POST /api/v1/chat/send - SSE streaming chat
router.post('/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  // Set SSE headers
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

    // Get or create session
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

    // Get character and persona for prompt building
    const character = session.character
      ? session.character
      : await prisma.characterCard.findUnique({ where: { id: params.characterId } })
    if (!character) {
      sendEvent({ type: 'error', code: 'CHARACTER_NOT_FOUND', message: '角色不存在' })
      res.end()
      return
    }

    let persona = null
    if (params.personaId) {
      persona = await prisma.persona.findUnique({ where: { id: params.personaId } })
    }

    // Get conversation history (from session if available, otherwise empty for new sessions)
    let history: Array<{ role: string; content: string }> = []
    if ('messages' in session && session.messages) {
      history = session.messages.map(m => ({
        role: m.role,
        content: m.content,
      }))
    } else {
      // For new session, get existing messages from database
      const messages = await prisma.chatMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      })
      history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))
    }

    // Build prompt
    const prompt = buildPrompt({
      character: {
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        lore: character.lore,
        systemPrompt: character.systemPrompt,
        exampleDialogs: character.exampleDialogs,
        firstMsg: character.firstMsg,
      },
      persona: persona ? { name: persona.name, description: persona.description } : null,
      history,
      currentMessage: params.message,
    })

    // Save user message
    await contextService.saveMessage(session.id, 'user', params.message)

    // Call AI proxy
    let fullResponse = ''
    await routeChat({
      userId,
      messages: prompt.messages,
      model: params.model,
      temperature: params.temperature,
      onToken: (token: string) => {
        fullResponse += token
        sendEvent({ type: 'token', content: token })
      },
      onDone: async (result) => {
        // Save AI response
        const msg = await contextService.saveMessage(session.id, 'character', fullResponse, result.tokens)
        sendEvent({ type: 'done', sessionId: session.id, messageId: msg.id, tokens: result.tokens })

        // Update character chat count
        await prisma.characterCard.update({
          where: { id: params.characterId },
          data: { chatCount: { increment: 1 } },
        })

        res.end()
      },
      onError: (err: Error) => {
        if (err.message === 'QUOTA_EXCEEDED') {
          sendEvent({ type: 'error', code: 'QUOTA_EXCEEDED', message: '今日免费额度已用完' })
        } else if (err.message === 'KEY_MISSING') {
          sendEvent({ type: 'error', code: 'KEY_MISSING', message: '未配置 API Key' })
        } else {
          sendEvent({ type: 'error', code: 'AI_ERROR', message: 'AI 服务暂时不可用' })
        }
        res.end()
      },
    })

    // Handle client disconnect
    req.on('close', () => {
      // Clean up if needed
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      sendEvent({ type: 'error', code: 'INVALID_PARAMS', message: '参数错误' })
    } else {
      sendEvent({ type: 'error', code: 'SERVER_ERROR', message: '服务器内部错误' })
    }
    res.end()
  }
})

// GET /api/v1/chat/sessions - My sessions list
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

// GET /api/v1/chat/sessions/:id - Session detail
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

// DELETE /api/v1/chat/sessions/:id - Delete session
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

export default router