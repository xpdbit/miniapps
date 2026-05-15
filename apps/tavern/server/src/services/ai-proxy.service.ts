import axios from 'axios'
import { config } from '../config'
import prisma from '../utils/prisma'
import { decrypt } from '../utils/crypto'
import { getDecryptedKey } from './key.service'

export interface ChatCompletionMessage {
  role: string
  content: string
}

export interface AiProxyParams {
  userId: string
  messages: ChatCompletionMessage[]
  model?: string
  temperature?: number
  onToken: (token: string) => void
  onDone: (result: { tokens: number }) => void
  onError: (err: Error) => void
}

// Check and deduct daily quota
async function checkQuota(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const quotaDate = new Date(user.quotaDate)
  quotaDate.setHours(0, 0, 0, 0)

  // Reset quota if it's a new day
  if (quotaDate.getTime() < today.getTime()) {
    await prisma.user.update({
      where: { id: userId },
      data: { usedQuota: 0, quotaDate: new Date() },
    })
    return true
  }

  return user.usedQuota < user.dailyQuota
}

export async function routeChat(params: AiProxyParams): Promise<void> {
  const { userId, messages, model, temperature, onToken, onDone, onError } = params

  try {
    // If user specified a platform model (tongyi)
    if (!model || model === 'tongyi') {
      const hasQuota = await checkQuota(userId)
      if (!hasQuota) {
        onError(new Error('QUOTA_EXCEEDED'))
        return
      }
      await callTongyi(messages, temperature, onToken, onDone, userId, model)
    } else {
      // User wants to use their own API key
      const decryptedKey = await getDecryptedKey(userId, model)
      if (!decryptedKey) {
        onError(new Error('KEY_MISSING'))
        return
      }

      await callOpenAICompatible(model, decryptedKey, messages, temperature, onToken, onDone)
    }
  } catch (err: unknown) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

// Call Tongyi (DashScope) API
async function callTongyi(
  messages: ChatCompletionMessage[],
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
  userId: string,
  _model?: string,
): Promise<void> {
  const response = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      model: 'qwen-turbo',
      input: { messages },
      parameters: {
        temperature: temperature ?? 0.8,
        result_format: 'message',
        incremental_output: true,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${config.dashscopeApiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 60000,
    },
  )

  let totalTokens = 0
  const stream = response.data as AsyncIterable<Buffer>

  for await (const chunk of stream) {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5))
          if (json.output?.text) {
            onToken(json.output.text)
            totalTokens += json.usage?.output_tokens || 0
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  // Deduct quota
  await prisma.user.update({
    where: { id: userId },
    data: { usedQuota: { increment: 1 } },
  })

  onDone({ tokens: totalTokens })
}

// Call OpenAI-compatible API
async function callOpenAICompatible(
  provider: string,
  apiKey: string,
  messages: ChatCompletionMessage[],
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
): Promise<void> {
  const baseUrls: Record<string, string> = {
    openai: 'https://api.openai.com',
    deepseek: 'https://api.deepseek.com',
    openrouter: 'https://openrouter.ai/api',
  }

  const baseUrl = baseUrls[provider] || 'https://api.openai.com'
  let totalTokens = 0

  const response = await axios.post(
    `${baseUrl}/v1/chat/completions`,
    {
      model: provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo',
      messages,
      temperature: temperature ?? 0.8,
      stream: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 60000,
    },
  )

  const stream = response.data as AsyncIterable<Buffer>
  for await (const chunk of stream) {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('data:') && !line.includes('[DONE]')) {
        try {
          const json = JSON.parse(line.slice(5))
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            onToken(content)
            totalTokens++
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}