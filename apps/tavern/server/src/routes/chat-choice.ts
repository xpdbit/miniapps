import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { buildPrompt } from '../services/prompt-builder.service'
import { routeChat, sanitizeAiText } from '../services/ai-proxy.service'
import * as contextService from '../services/context.service'
import { parseAiScriptResponse, serializeEventLog, gameStateStore } from '../services/ai-scripts'
import prisma from '../utils/prisma'

const router = Router()

const choiceSchema = z.object({
  sessionId: z.string(),
  choiceLabel: z.string().min(1).max(50),
  choiceDescription: z.string().min(1).max(100),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  saveId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
  userPersonaId: z.string().optional(),
  // Whether to request new choices after AI responds
  requestChoice: z.boolean().optional(),
})

// POST /api/v1/chat/choice - submit player choice and continue narrative
router.post('/choice', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const params = choiceSchema.parse(req.body)
    const userId = req.user!.userId

    const session = await contextService.getSession(params.sessionId, userId)
    if (!session) {
      sendEvent({ type: 'error', code: 'SESSION_NOT_FOUND', message: '会话不存在' })
      res.end()
      return
    }

    // Get session character
    const sessionAny = session as { character?: { name: string; description: string; prompt?: string | null } | null }
    const character = sessionAny.character
    if (!character) {
      sendEvent({ type: 'error', code: 'CHARACTER_NOT_FOUND', message: '角色不存在' })
      res.end()
      return
    }

    // Load persona
    let persona = null
    if (params.userPersonaId) {
      persona = await prisma.tavernPersona.findUnique({ where: { id: params.userPersonaId } })
    }

    // Build history
    const sessionWithMsgs = session as { messages?: { role: string; content: string }[] }
    const history = (sessionWithMsgs.messages ?? []).map(m => ({ role: m.role, content: m.content }))

    // Construct choice message
    const choiceMessage = persona
      ? `${persona.name}：${params.choiceLabel}——${params.choiceDescription}`
      : `用户：${params.choiceLabel}——${params.choiceDescription}`

    // Build prompt
    const prompt = buildPrompt({
      character: { name: character.name, description: character.description, prompt: character.prompt },
      characterId: (session as { characterId?: string }).characterId,
      persona: persona ? { name: persona.name, description: persona.description } : null,
      history,
      currentMessage: choiceMessage,
    })

    // Stream AI response
    let fullResponse = ''
    let aborted = false
    req.on('close', () => { aborted = true })

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
        if (aborted || !fullResponse.trim()) {
          if (!res.writableEnded) {
            sendEvent({ type: 'error', code: 'AI_ERROR', message: 'AI 返回了空响应' })
            res.end()
          }
          return
        }

        // Parse AI Script events
        const parsed = parseAiScriptResponse(fullResponse)
        fullResponse = parsed.narrative

        const msg = await contextService.saveMessage(session.id, 'character', fullResponse, result.tokens, true)

        // Execute events if game mode
        const hasGameMode = !!(params.saveId && params.characterIds?.length)
        if (hasGameMode && parsed.events.length > 0) {
          await gameStateStore.applyEvents(params.saveId!, parsed.events)
          const eventLog = serializeEventLog(parsed.events)
          await contextService.saveMessage(session.id, 'system', eventLog, 0, true)
        }

        if (!res.writableEnded) {
          sendEvent({ type: 'done', sessionId: session.id, messageId: msg.id, tokens: result.tokens })
        }

        if (hasGameMode && parsed.events.length > 0) {
          sendEvent({ type: 'events', events: parsed.events })
          const updatedState = await gameStateStore.getState(params.saveId!)
          if (updatedState) {
            sendEvent({ type: 'state', state: updatedState })
          }
        }

        // If requestChoice, generate next choices
        if (params.requestChoice && hasGameMode) {
          try {
            const { buildChoicePrompt } = await import('../services/prompt-builder.service')
            const { generateChoices } = await import('../services/ai-proxy.service')
            const personaName = persona?.name ?? '冒险者'
            const choicePrompt = buildChoicePrompt({
              personaName,
              personaDescription: persona?.description ?? null,
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
          } catch { /* silent */ }
        }

        res.end()
      },
      onError: (err: Error) => {
        if (!res.writableEnded) {
          sendEvent({ type: 'error', code: 'AI_ERROR', message: err.message })
          res.end()
        }
      },
    })
  } catch (err) {
    if (!res.writableEnded) {
      sendEvent({ type: 'error', code: 'SERVER_ERROR', message: '服务器内部错误' })
      res.end()
    }
  }
})

export default router
