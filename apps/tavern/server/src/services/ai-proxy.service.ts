import axios from 'axios'
import { config } from '../config'
import prisma from '../utils/prisma'
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

/* ========================================================================
 *  模型 → 提供商 映射表
 *  ======================================================================== */
const MODEL_PROVIDER_MAP: Record<string, string> = {
  // 通义千问（DashScope，免费默认）
  'qwen-turbo': 'tongyi',
  'qwen-plus': 'tongyi',
  'qwen-max': 'tongyi',
  // OpenCode Go（免费默认）
  'big-pickle': 'opencode',
  'minimax-m2.5-free': 'opencode',
  'deepseek-v4-flash-free': 'opencode',
  // 用户自配密钥的提供商
  'gpt-4o': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-3.5-turbo': 'openai',
  'deepseek-chat': 'deepseek',
  'deepseek-reasoner': 'deepseek',
  'claude-3.5-sonnet': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-haiku': 'anthropic',
  'gemini-2.5-pro': 'google',
  'gemini-2.5-flash': 'google',
  'glm-4': 'zhipu',
  'chatglm-turbo': 'zhipu',
  'moonshot-v1-8k': 'moonshot',
  'moonshot-v1-32k': 'moonshot',
  'abab6.5s': 'minimax',
  'abab7': 'minimax',
  // OpenRouter（通用网关）
  'openrouter-auto': 'openrouter',
}

/* ========================================================================
 *  提供商配置（base URL + 默认模型）
 *  ======================================================================== */
const PROVIDER_CONFIGS: Record<string, { baseUrl: string; defaultModel: string; apiFormat: 'openai' | 'anthropic' | 'google' }> = {
  tongyi: { baseUrl: '', defaultModel: 'qwen-turbo', apiFormat: 'openai' },
  opencode: { baseUrl: config.opencodeBaseUrl, defaultModel: 'big-pickle', apiFormat: 'openai' },
  openai: { baseUrl: 'https://api.openai.com', defaultModel: 'gpt-3.5-turbo', apiFormat: 'openai' },
  deepseek: { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', apiFormat: 'openai' },
  openrouter: { baseUrl: 'https://openrouter.ai/api', defaultModel: 'gpt-3.5-turbo', apiFormat: 'openai' },
  anthropic: { baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3.5-sonnet', apiFormat: 'anthropic' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.5-flash', apiFormat: 'google' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4', apiFormat: 'openai' },
  moonshot: { baseUrl: 'https://api.moonshot.cn', defaultModel: 'moonshot-v1-8k', apiFormat: 'openai' },
  minimax: { baseUrl: 'https://api.minimax.chat', defaultModel: 'abab6.5s', apiFormat: 'openai' },
}

/* ========================================================================
 *  每日配额检查与扣除
 *  ======================================================================== */

async function checkQuota(userId: string): Promise<boolean> {
  const user = await prisma.sharedUser.findUnique({ where: { id: userId } })
  if (!user) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const quotaDate = new Date(user.quotaDate)
  quotaDate.setHours(0, 0, 0, 0)

  if (quotaDate.getTime() < today.getTime()) {
    await prisma.sharedUser.update({
      where: { id: userId },
      data: { usedQuota: 0, quotaDate: new Date() },
    })
    return true
  }

  return user.usedQuota < user.dailyQuota
}

async function deductQuota(userId: string): Promise<void> {
  await prisma.sharedUser.update({
    where: { id: userId },
    data: { usedQuota: { increment: 1 } },
  })
}

/* ========================================================================
 *  主路由入口
 *  ======================================================================== */

export async function routeChat(params: AiProxyParams): Promise<void> {
  const { userId, messages, model, temperature, onToken, onDone, onError } = params

  try {
    // 解析模型对应的提供商
    const modelKey = model || 'qwen-turbo'
    const provider = MODEL_PROVIDER_MAP[modelKey] || 'tongyi'
    const providerConfig = PROVIDER_CONFIGS[provider]

    if (!providerConfig) {
      onError(new Error(`未知的提供商: ${provider}`))
      return
    }

    // 免费提供商（使用系统配额）
    if (provider === 'tongyi' || provider === 'opencode') {
      const hasQuota = await checkQuota(userId)
      if (!hasQuota) {
        onError(new Error('QUOTA_EXCEEDED'))
        return
      }

      if (provider === 'tongyi') {
        await callDashScope(messages, modelKey, temperature, onToken, onDone)
      } else {
        await callOpenCodeGo(messages, modelKey, temperature, onToken, onDone)
      }

      await deductQuota(userId)
      return
    }

    // 用户自配密钥的提供商
    const decryptedKey = await getDecryptedKey(userId, provider)
    if (!decryptedKey) {
      onError(new Error('KEY_MISSING'))
      return
    }

    switch (providerConfig.apiFormat) {
      case 'anthropic':
        await callAnthropic(providerConfig, decryptedKey, messages, modelKey, temperature, onToken, onDone)
        break
      case 'google':
        await callGoogle(providerConfig, decryptedKey, messages, modelKey, temperature, onToken, onDone)
        break
      default:
        await callOpenAICompatible(providerConfig, decryptedKey, messages, modelKey, temperature, onToken, onDone)
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
): Promise<void> {
  const apiKey = config.opencodeApiKey
  if (!apiKey) {
    throw new Error('OpenCode Go API Key 未配置')
  }

  const baseUrl = config.opencodeBaseUrl
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
    },
  )

  let totalTokens = 0
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
          }
          if (json.usage) {
            totalTokens = json.usage.total_tokens || json.usage.totalTokens || totalTokens
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
   }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  OpenAI 兼容接口（OpenAI / DeepSeek / 智谱 / 月之暗面 / MiniMax）
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
          if (content) {
            onToken(content)
          }
          // 提取真实 token 用量（最终数据块通常包含 usage）
          if (json.usage) {
            totalTokens = json.usage.total_tokens || json.usage.totalTokens || totalTokens
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  Anthropic Messages API
 *  格式差异：系统提示词 → system 字段，消息列表 → messages[]
 *  角色映射：assistant → assistant, user → user
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

  // Anthropic 格式：system 独立字段，messages 不含 system
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
          // 提取真实 token 用量（message_stop 或 message_delta 事件中包含 usage）
          if (json.usage) {
            totalTokens = json.usage.output_tokens || json.usage.total_tokens || totalTokens
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}

/* ========================================================================
 *  Google Gemini API
 *  格式差异：system 指令 → systemInstruction 字段
 *  角色映射：assistant → model, user → user
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

  // Google 格式：分离 systemInstruction 和 contents
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
      // Google 流式响应使用标准 SSE 格式: data:{...}
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5))
          if (json.candidates?.[0]?.content?.parts) {
            for (const part of json.candidates[0].content.parts) {
              if (part.text) {
                onToken(part.text)
              }
            }
          }
          // 提取真实 token 用量
          if (json.usageMetadata) {
            totalTokens += json.usageMetadata.totalTokens || 0
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  onDone({ tokens: totalTokens })
}
