// Minimal provider configs — used only by useDirectAI hook (legacy privacy mode)
// Main AI config is now managed via Dashboard → config-provider.service.ts
export type AiProvider = 'opencode' | 'tongyi' | 'openai' | 'anthropic' | 'deepseek' | 'zhipu' | 'moonshot' | 'minimax'

export const PROVIDER_CONFIGS: Record<AiProvider, { baseUrl: string; defaultModel: string }> = {
  opencode:  { baseUrl: 'https://api.opencode.com/v1/chat/completions',      defaultModel: 'qwen-turbo' },
  tongyi:    { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel: 'qwen-plus' },
  openai:    { baseUrl: 'https://api.openai.com/v1/chat/completions',        defaultModel: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1/messages',             defaultModel: 'claude-3-haiku-20240307' },
  deepseek:  { baseUrl: 'https://api.deepseek.com/v1/chat/completions',      defaultModel: 'deepseek-chat' },
  zhipu:     { baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-4-flash' },
  moonshot:  { baseUrl: 'https://api.moonshot.cn/v1/chat/completions',       defaultModel: 'moonshot-v1-8k' },
  minimax:   { baseUrl: 'https://api.minimaxi.com/v1/chat/completions',      defaultModel: 'abab6.5s' },
}
