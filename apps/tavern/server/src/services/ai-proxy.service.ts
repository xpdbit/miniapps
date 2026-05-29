import axios from 'axios'
import { config } from '../config'
import prisma from '../utils/prisma'
import { getDecryptedKey } from './key.service'
import { getProviders, getProvidersForModel } from './config-provider.service'
import { checkRateLimit } from './rate-limiter.service'

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
  signal?: AbortSignal
}

/* ========================================================================
 *  每日配额检查与扣除（合并为一次原子操作）
 *  ======================================================================== */

async function checkAndDeductQuota(userId: string): Promise<boolean> {
  const tier = await prisma.tavernUserTier.findUnique({ where: { userUuid: userId } })
  if (!tier) {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const quotaDate = new Date(tier.quotaDate)
  quotaDate.setHours(0, 0, 0, 0)

  if (quotaDate.getTime() < today.getTime()) {
    await prisma.tavernUserTier.update({
      where: { userUuid: userId },
      data: { dailyQuotaUsed: 1, quotaDate: new Date() },
    })
    return true
  }

  if (tier.dailyQuotaUsed >= tier.dailyQuotaMax) {
    return false
  }

  await prisma.tavernUserTier.update({
    where: { userUuid: userId },
    data: { dailyQuotaUsed: { increment: 1 } },
  })
  return true
}

/* ========================================================================
 *  Provider 选择 — 从 config-provider 动态获取，非硬编码
 *  ======================================================================== */

const FREE_PROVIDERS = ['tongyi', 'opencode', 'deepseek']

async function resolveProvider(modelKey: string): Promise<{
  provider: string
  apiKey: string
  baseUrl: string
  apiFormat: 'openai' | 'anthropic' | 'google'
  isFree: boolean
}> {
  // 1. 从动态配置获取该模型可用的 Provider 列表
  const candidates = await getProvidersForModel(modelKey)

  if (candidates.length === 0) {
    // 降级：尝试 tongyi
    return {
      provider: 'tongyi',
      apiKey: config.dashscopeApiKey || '',
      baseUrl: '',
      apiFormat: 'openai',
      isFree: true,
    }
  }

  // 2. 按权重排序，逐个过限流
  for (const pc of candidates) {
    const { allowed } = await checkRateLimit(pc.provider)
    if (!allowed) continue

    // 3. 获取 API Key（Dashboard → Env 降级）
    const apiKey = pc.apiKey
      || (pc.provider === 'tongyi' ? config.dashscopeApiKey : '')
      || (pc.provider === 'opencode' ? config.opencodeApiKey : '')
      || (pc.provider === 'deepseek' ? config.deepseekApiKey : '')
      || ''

    const baseUrl = pc.baseUrl
      || (pc.provider === 'opencode' ? config.opencodeBaseUrl : '')
      || ''

    const apiFormat = pc.config?.apiFormat || 'openai'
    const isFree = FREE_PROVIDERS.includes(pc.provider)

    return { provider: pc.provider, apiKey, baseUrl, apiFormat, isFree }
  }

  // 所有 Provider 超限
  throw new Error('所有 AI 提供商均超限，请稍后重试')
}

/* ========================================================================
 *  主路由入口
 *  ======================================================================== */

export async function routeChat(params: AiProxyParams): Promise<void> {
  const { userId, messages, model, temperature, onToken, onDone, onError, signal } = params

  try {
    if (signal?.aborted) {
      onError(new Error('REQUEST_CANCELLED'))
      return
    }

    const modelKey = model || 'deepseek-chat'

    // 🆕 动态解析 Provider（替代硬编码 MODEL_PROVIDER_MAP）
    const resolved = await resolveProvider(modelKey)

    // 免费 Provider → 检查用户配额
    if (resolved.isFree) {
      const hasQuota = await checkAndDeductQuota(userId)
      if (!hasQuota) {
        onError(new Error('QUOTA_EXCEEDED'))
        return
      }
    }

    // 非免费 Provider → 查用户自配 Key
    let apiKey = resolved.apiKey
    let baseUrl = resolved.baseUrl

    if (!resolved.isFree) {
      const userKey = await getDecryptedKey(userId, resolved.provider)
      if (!userKey) {
        onError(new Error('KEY_MISSING'))
        return
      }
      apiKey = userKey.key
      baseUrl = userKey.baseUrl || baseUrl
    }

    // 按 Provider 分发（保留流式调用函数）
    switch (resolved.provider) {
      case 'tongyi':
        await callDashScope(messages, modelKey, temperature, onToken, onDone, apiKey)
        break
      case 'opencode':
        await callOpenCodeGo(messages, modelKey, temperature, onToken, onDone, apiKey, baseUrl || config.opencodeBaseUrl)
        break
      case 'deepseek':
        await callDeepSeekFree(messages, modelKey, temperature, onToken, onDone, apiKey)
        break
      default:
        // OpenAI-compatible / Anthropic / Google
        const providerConfig = { baseUrl, defaultModel: modelKey, apiFormat: resolved.apiFormat as 'openai' | 'anthropic' | 'google' }
        switch (resolved.apiFormat) {
          case 'anthropic':
            await callAnthropic(providerConfig, apiKey, messages, modelKey, temperature, onToken, onDone)
            break
          case 'google':
            await callGoogle(providerConfig, apiKey, messages, modelKey, temperature, onToken, onDone)
            break
          default:
            await callOpenAICompatible(providerConfig, apiKey, messages, modelKey, temperature, onToken, onDone)
        }
    }
  } catch (err: unknown) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

/* ========================================================================
 *  DashScope（通义千问）
 *  ======================================================================== */

async function callDashScope(
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
  apiKey: string,
): Promise<void> {
  const response = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      model,
      input: { messages },
      parameters: {
        temperature: temperature ?? 0.8,
        result_format: 'message',
        incremental_output: true,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 60000,
      validateStatus: null,
    },
  )

  if (response.status < 200 || response.status >= 300) {
    const body = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data)
    throw new Error(`DashScope API 返回错误 ${response.status}: ${body.slice(0, 200)}`)
  }

  let totalTokens = 0
  const stream = response.data as AsyncIterable<Buffer>

  for await (const chunk of stream) {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5))
          const text = json.output?.text
            || json.output?.choices?.[0]?.messages?.[0]?.content
          if (text) {
            onToken(text)
          }
          if (json.usage?.output_tokens) {
            totalTokens += json.usage.output_tokens
          }
        } catch {
          // Skip
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  OpenCode Go（免费默认）
 *  ======================================================================== */

async function callOpenCodeGo(
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  if (!apiKey) throw new Error('OpenCode Go API Key 未配置')

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
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
      validateStatus: null,
    },
  )

  if (response.status < 200 || response.status >= 300) {
    let errorBody = ''
    try {
      const stream = response.data as AsyncIterable<Buffer>
      for await (const chunk of stream) errorBody += chunk.toString()
      const errJson = JSON.parse(errorBody)
      throw new Error(errJson?.error?.message || `OpenCode Go API 返回错误 ${response.status}`)
    } catch (parseErr: unknown) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`OpenCode Go API 返回错误 ${response.status}: ${errorBody.slice(0, 200)}`)
      }
      throw parseErr
    }
  }

  let totalTokens = 0
  const stream = response.data as AsyncIterable<Buffer>
  for await (const chunk of stream) {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('data:') && !line.includes('[DONE]')) {
        try {
          const json = JSON.parse(line.slice(5))
          const content = json.choices?.[0]?.delta?.content
          if (content) onToken(content)
          if (json.usage) {
            totalTokens = json.usage.total_tokens || json.usage.totalTokens || totalTokens
          }
        } catch {
          // Skip
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  DeepSeek Free（系统级免费 Key）
 *  ======================================================================== */

async function callDeepSeekFree(
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
  apiKey: string,
): Promise<void> {
  if (!apiKey) throw new Error('DeepSeek API Key 未配置')

  let totalTokens = 0
  const actualModel = model || 'deepseek-chat'
  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: actualModel,
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
      validateStatus: null,
    },
  )

  if (response.status < 200 || response.status >= 300) {
    let errorBody = ''
    try {
      const stream = response.data as AsyncIterable<Buffer>
      for await (const chunk of stream) errorBody += chunk.toString()
      const errJson = JSON.parse(errorBody)
      throw new Error(errJson?.error?.message || `DeepSeek API 返回错误 ${response.status}`)
    } catch (parseErr: unknown) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`DeepSeek API 返回错误 ${response.status}: ${errorBody.slice(0, 200)}`)
      }
      throw parseErr
    }
  }

  const stream = response.data as AsyncIterable<Buffer>
  for await (const chunk of stream) {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('data:') && !line.includes('[DONE]')) {
        try {
          const json = JSON.parse(line.slice(5))
          const content = json.choices?.[0]?.delta?.content
          if (content) onToken(content)
          if (json.usage) {
            totalTokens = json.usage.total_tokens || json.usage.totalTokens || totalTokens
          }
        } catch {
          // Skip
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  非流式生成（世界构筑等一次性调用）
 *  ======================================================================== */

export function sanitizeAiText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\u2028/g, ' ')
    .replace(/\u2029/g, ' ')
    .replace(/[\uFEFF\uFFFE]/g, '')
    .replace(/\uFFFF/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
}

export async function generateText(params: {
  userId: string
  messages: ChatCompletionMessage[]
  model?: string
  temperature?: number
}): Promise<string> {
  const { userId, messages, model, temperature } = params
  return new Promise<string>((resolve, reject) => {
    let fullText = ''
    routeChat({
      userId,
      messages,
      model,
      temperature,
      onToken: (token: string) => {
        fullText += token
      },
      onDone: () => {
        if (!fullText || !fullText.trim()) {
          reject(new Error('AI 返回了空响应，请检查模型配置或稍后重试'))
          return
        }
        resolve(sanitizeAiText(fullText))
      },
      onError: (err: Error) => {
        reject(err)
      },
    })
  })
}

/* ========================================================================
 *  OpenAI 兼容接口
 *  ======================================================================== */

async function callOpenAICompatible(
  providerConfig: { baseUrl: string; defaultModel: string },
  apiKey: string,
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
): Promise<void> {
  const actualModel = model || providerConfig.defaultModel
  let totalTokens = 0

  const response = await axios.post(
    `${providerConfig.baseUrl}/v1/chat/completions`,
    {
      model: actualModel,
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
          if (content) onToken(content)
          if (json.usage) {
            totalTokens = json.usage.total_tokens || json.usage.totalTokens || totalTokens
          }
        } catch {
          // Skip
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  Anthropic Messages API
 *  ======================================================================== */

async function callAnthropic(
  providerConfig: { baseUrl: string; defaultModel: string },
  apiKey: string,
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
): Promise<void> {
  const actualModel = model || providerConfig.defaultModel

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

  let totalTokens = 0

  const response = await axios.post(
    `${providerConfig.baseUrl}/v1/messages`,
    {
      model: actualModel,
      system: systemMsg?.content || undefined,
      messages: chatMessages,
      max_tokens: 4096,
      temperature: temperature ?? 0.8,
      stream: true,
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
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
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5))
          if (json.type === 'content_block_delta' && json.delta?.text) {
            onToken(json.delta.text)
          }
          if (json.usage) {
            totalTokens = json.usage.output_tokens || json.usage.total_tokens || totalTokens
          }
        } catch {
          // Skip
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  Google Gemini API
 *  ======================================================================== */

async function callGoogle(
  providerConfig: { baseUrl: string; defaultModel: string },
  apiKey: string,
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
): Promise<void> {
  const actualModel = model || providerConfig.defaultModel

  const systemMsg = messages.find((m) => m.role === 'system')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  let totalTokens = 0

  const response = await axios.post(
    `${providerConfig.baseUrl}/v1beta/models/${actualModel}:streamGenerateContent`,
    {
      systemInstruction: systemMsg
        ? { parts: [{ text: systemMsg.content }] }
        : undefined,
      contents,
      generationConfig: {
        temperature: temperature ?? 0.8,
        maxOutputTokens: 4096,
      },
    },
    {
      headers: {
        'x-goog-api-key': apiKey,
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
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5))
          if (json.candidates?.[0]?.content?.parts) {
            for (const part of json.candidates[0].content.parts) {
              if (part.text) onToken(part.text)
            }
          }
          if (json.usageMetadata) {
            totalTokens += json.usageMetadata.totalTokens || 0
          }
        } catch {
          // Skip
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}
