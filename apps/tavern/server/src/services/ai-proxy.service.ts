import axios from 'axios'
import { config } from '../config'
import prisma from '../utils/prisma'
import { getDecryptedKey } from './key.service'
import { getProviderApiKey, getProviderBaseUrl } from './admin-config.service'

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
  'deepseek-v4-flash': 'opencode',
  'deepseek-v4-pro': 'opencode',
  // 用户自配密钥的提供商
  'gpt-4o': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-3.5-turbo': 'openai',
  // DeepSeek（系统级免费 Key）
  'deepseek-chat': 'deepseek_free',
  'deepseek-reasoner': 'deepseek_free',
  'claude-3.5-sonnet': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-haiku': 'anthropic',
  'gemini-2.5-pro': 'google',
  'gemini-2.5-flash': 'google',
  'glm-4': 'zhipu',
  'chatglm-turbo': 'zhipu',
  'moonshot-v1-8k': 'moonshot',
  'moonshot-v1-32k': 'moonshot',
  // MiniMax v2 direct (系统级 key 已过期，保留用于用户自配 key)
  'MiniMax-Text-01': 'minimax',
  // MiniMax v1 legacy models → route through OpenCode (v2 endpoint incompatible)
  'abab5.5-chat': 'opencode',
  'abab5-chat': 'opencode',
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
  minimax: { baseUrl: 'https://api.minimaxi.com', defaultModel: 'abab6.5s', apiFormat: 'openai' },
  deepseek_free: { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', apiFormat: 'openai' },
  oneapi: { baseUrl: '', defaultModel: 'gpt-3.5-turbo', apiFormat: 'openai' },
}

/* ========================================================================
 *  每日配额检查与扣除（合并为一次原子操作，省去重复 SELECT）
 *  ======================================================================== */

async function checkAndDeductQuota(userId: string): Promise<boolean> {
  const tier = await prisma.tavernUserTier.findUnique({ where: { userUuid: userId } })
  if (!tier) {
    return false // 无等级记录视为超额
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const quotaDate = new Date(tier.quotaDate)
  quotaDate.setHours(0, 0, 0, 0)

  if (quotaDate.getTime() < today.getTime()) {
    // 新一天：重置计数器并从 1 开始（原子 update 内部 SELECT+UPDATE+SELECT）
    await prisma.tavernUserTier.update({
      where: { userUuid: userId },
      data: { dailyQuotaUsed: 1, quotaDate: new Date() },
    })
    return true
  }

  if (tier.dailyQuotaUsed >= tier.dailyQuotaMax) {
    return false
  }

  // 额度充足：直接递增
  await prisma.tavernUserTier.update({
    where: { userUuid: userId },
    data: { dailyQuotaUsed: { increment: 1 } },
  })
  return true
}

/* ========================================================================
 *  主路由入口
 *  ======================================================================== */

export async function routeChat(params: AiProxyParams): Promise<void> {
  const { userId, messages, model, temperature, onToken, onDone, onError, signal } = params

  try {
    // Check for abort before doing any work
    if (signal?.aborted) {
      onError(new Error('REQUEST_CANCELLED'))
      return
    }

    // 从 Dashboard Admin API 获取 AI Provider 配置（含 API Key），环境变量作为降级
    const [dashscopeKey, opencodeKey, deepseekKey] = await Promise.all([
      getProviderApiKey('tongyi').catch(() => null),
      getProviderApiKey('opencode').catch(() => null),
      getProviderApiKey('deepseek').catch(() => null),
    ])
    const opencodeBaseUrl = await getProviderBaseUrl('opencode').catch(() => null)
    const effectiveDashscopeKey = dashscopeKey || config.dashscopeApiKey || ''
    const effectiveOpencodeKey = opencodeKey || config.opencodeApiKey || ''
    const effectiveDeepseekKey = deepseekKey || config.deepseekApiKey || ''
    const effectiveOpencodeBaseUrl = opencodeBaseUrl || config.opencodeBaseUrl

    // 解析模型对应的提供商
    let modelKey = model || 'deepseek-chat'
    let provider = MODEL_PROVIDER_MAP[modelKey]

    // 硬编码映射未命中时，从数据库 TavernModelMeta 查找 provider
    if (!provider) {
      const modelMeta = await prisma.tavernModelMeta.findUnique({
        where: { modelId: modelKey },
        select: { provider: true },
      })
      if (modelMeta && PROVIDER_CONFIGS[modelMeta.provider]) {
        provider = modelMeta.provider
      } else {
        provider = 'tongyi' // 最终兜底
      }
    }

    // Fallback: DashScope key 未配置或为占位符时，自动回退到 DeepSeek Free
    // 同时检查 Dashboard Admin API 和环境变量
    if (provider === 'tongyi' && (!effectiveDashscopeKey || effectiveDashscopeKey === 'sk_dev_key' || effectiveDashscopeKey === '')) {
      console.warn('[ai-proxy] DashScope key 未配置，模型 ' + modelKey + ' 已自动回退到 deepseek-chat')
      provider = 'deepseek_free'
      modelKey = 'deepseek-chat'
    }

    const providerConfig = PROVIDER_CONFIGS[provider]

    if (!providerConfig) {
      onError(new Error(`未知的提供商: ${provider}`))
      return
    }

    // 免费提供商（使用系统配额）
    if (provider === 'tongyi' || provider === 'opencode' || provider === 'deepseek_free') {
      // 检查并扣除配额（合并为一次原子操作，省去原 checkQuota + deductQuota 的重复 SELECT）
      const hasQuota = await checkAndDeductQuota(userId)
      if (!hasQuota) {
        onError(new Error('QUOTA_EXCEEDED'))
        return
      }

      if (provider === 'tongyi') {
        // DashScope 自动回退：不可用时降级到 DeepSeek Free
        try {
          await callDashScope(messages, modelKey, temperature, onToken, onDone, effectiveDashscopeKey)
        } catch (err) {
          console.warn('[ai-proxy] DashScope 请求失败(' + (err instanceof Error ? err.message : String(err)) + ')，自动回退到 deepseek-chat')
          await callDeepSeekFree(messages, 'deepseek-chat', temperature, onToken, onDone, effectiveDeepseekKey)
        }
      } else if (provider === 'deepseek_free') {
        // DeepSeek Free 自动回退：不可用时降级到 OpenCode Go（最终兜底）
        try {
          await callDeepSeekFree(messages, modelKey, temperature, onToken, onDone, effectiveDeepseekKey)
        } catch (err) {
          console.warn('[ai-proxy] DeepSeek Free 请求失败(' + (err instanceof Error ? err.message : String(err)) + ')，自动回退到 big-pickle (OpenCode Go)')
          try {
            await callOpenCodeGo(messages, 'big-pickle', temperature, onToken, onDone, effectiveOpencodeKey, effectiveOpencodeBaseUrl)
          } catch (err2) {
            const msg = (err2 instanceof Error ? err2.message : String(err2))
            console.error('[ai-proxy] 所有免费 AI 提供商均不可用: ' + msg)
            onError(new Error('所有免费 AI 提供商暂时不可用，请稍后重试'))
          }
        }
      } else {
        // opencode — 自动回退机制：OpenCode Go 不可用时降级到 DeepSeek Free
        try {
          await callOpenCodeGo(messages, modelKey, temperature, onToken, onDone, effectiveOpencodeKey, effectiveOpencodeBaseUrl)
        } catch (err) {
          console.warn('[ai-proxy] OpenCode Go 请求失败(' + (err instanceof Error ? err.message : String(err)) + ')，自动回退到 deepseek-chat')
          await callDeepSeekFree(messages, 'deepseek-chat', temperature, onToken, onDone, effectiveDeepseekKey)
        }
      }

      return
    }

    // 用户自配密钥的提供商
    const decryptedKey = await getDecryptedKey(userId, provider)
    if (!decryptedKey) {
      onError(new Error('KEY_MISSING'))
      return
    }

    // 自定义 baseUrl 优先于硬编码配置
    const effectiveBaseUrl = decryptedKey.baseUrl || providerConfig.baseUrl
    const effectiveConfig = { ...providerConfig, baseUrl: effectiveBaseUrl }

    switch (providerConfig.apiFormat) {
      case 'anthropic':
        await callAnthropic(effectiveConfig, decryptedKey.key, messages, modelKey, temperature, onToken, onDone)
        break
      case 'google':
        await callGoogle(effectiveConfig, decryptedKey.key, messages, modelKey, temperature, onToken, onDone)
        break
      default:
        await callOpenAICompatible(effectiveConfig, decryptedKey.key, messages, modelKey, temperature, onToken, onDone)
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

  // Handle non-2xx responses
  if (response.status < 200 || response.status >= 300) {
    const body = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data)
    throw new Error(`DashScope API 返回错误 ${response.status}: ${body.slice(0, 200)}`)
  }

  let totalTokens = 0
  let hasContent = false
  const stream = response.data as AsyncIterable<Buffer>

  for await (const chunk of stream) {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const json = JSON.parse(line.slice(5))
          // DashScope returns content differently based on result_format:
          // - 'text' format: output.text
          // - 'message' format: output.choices[0].messages[0].content
          const text = json.output?.text
            || json.output?.choices?.[0]?.messages?.[0]?.content
          if (text) {
            onToken(text)
            hasContent = true
          }
          if (json.usage?.output_tokens) {
            totalTokens += json.usage.output_tokens
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
  apiKey: string,
  baseUrl: string,
): Promise<void> {
  if (!apiKey) {
    throw new Error('OpenCode Go API Key 未配置')
  }
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

  // Handle non-2xx responses
  if (response.status < 200 || response.status >= 300) {
    let errorBody = ''
    try {
      const stream = response.data as AsyncIterable<Buffer>
      for await (const chunk of stream) {
        errorBody += chunk.toString()
      }
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
 *  DeepSeek（系统级免费 Key，OpenAI 兼容接口）
 *  ======================================================================== */

async function callDeepSeekFree(
  messages: ChatCompletionMessage[],
  model: string,
  temperature: number | undefined,
  onToken: (token: string) => void,
  onDone: (result: { tokens: number }) => void,
  apiKey: string,
): Promise<void> {
  if (!apiKey) {
    throw new Error('DeepSeek API Key 未配置')
  }

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

  // Handle non-2xx responses
  if (response.status < 200 || response.status >= 300) {
    let errorBody = ''
    try {
      const stream = response.data as AsyncIterable<Buffer>
      for await (const chunk of stream) {
        errorBody += chunk.toString()
      }
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
 *  非流式生成（用于世界构筑等一次性 AI 调用）
 *  ======================================================================== */

/**
 * Sanitize AI-generated text to prevent JSON encoding issues.
 * Removes characters that may cause JSON.parse failures in certain
 * JavaScript engines (e.g. WeChat Mini Program's WASubContext):
 *   - Control characters (U+0000-U+001F) except common whitespace
 *   - Unicode line/paragraph separators (U+2028, U+2029)
 *   - Surrogate characters and BOM
 */
export function sanitizeAiText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // control chars (keep \t \n \r)
    .replace(/\u2028/g, ' ')  // LINE SEPARATOR → space (safe for JSON & display)
    .replace(/\u2029/g, ' ')  // PARAGRAPH SEPARATOR → space (safe for JSON & display)
    .replace(/[\uFEFF\uFFFE]/g, '')  // BOM (U+FEFF) & reversed BOM (U+FFFE)
    .replace(/\uFFFF/g, '')          // noncharacter
    .replace(/[\uD800-\uDFFF]/g, '') // unpaired surrogates
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
