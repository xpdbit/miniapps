import Taro from '@tarojs/taro'

export type AiProvider = 'opencode' | 'tongyi' | 'openai' | 'anthropic' | 'deepseek' | 'zhipu' | 'moonshot' | 'minimax'

export interface AiClientConfig {
  provider: AiProvider
  model: string
  apiKey?: string
  baseUrl?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const PROVIDER_CONFIGS: Record<AiProvider, { baseUrl: string; defaultModel: string }> = {
  opencode: {
    baseUrl: 'https://api.opencode.com/v1/chat/completions',
    defaultModel: 'qwen-turbo',
  },
  tongyi: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-haiku-20240307',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-flash',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-8k',
  },
  minimax: {
    baseUrl: 'https://api.minimaxi.com/v1/chat/completions',
    defaultModel: 'abab6.5s',
  },
}

function getConfig(provider: AiProvider, model?: string): { baseUrl: string; model: string } {
  const cfg = PROVIDER_CONFIGS[provider]
  return {
    baseUrl: cfg.baseUrl,
    model: model || cfg.defaultModel,
  }
}

export async function aiGenerateText(
  config: AiClientConfig,
  messages: ChatMessage[],
): Promise<string> {
  const { baseUrl, model } = getConfig(config.provider, config.model)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  try {
    const res = await Taro.request({
      url: baseUrl,
      method: 'POST',
      header: headers,
      data: {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      },
      timeout: 60000,
    })
    return res.data?.choices?.[0]?.message?.content || ''
  } catch (err) {
    console.error('[aiClient] generate error:', err)
    throw err
  }
}

export async function aiGenerateJSON<T>(
  config: AiClientConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const text = await aiGenerateText(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ])
  // Try to parse JSON from response (may have markdown wrapping)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/)
  const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text
  return JSON.parse(jsonStr)
}