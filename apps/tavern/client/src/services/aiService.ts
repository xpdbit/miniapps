import { httpClient } from './httpClient'

interface GenerateParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  model?: string
  temperature?: number
}

interface GenerateResponse {
  code: number
  data: { text: string } | null
  message: string
}

/**
 * Call AI generation through tavern server proxy.
 * Routes through server instead of calling external APIs directly from mini-program.
 * Uses 60s timeout (AI world building is a long generation task).
 */
export async function generateText(params: GenerateParams): Promise<string> {
  const res = await httpClient.request<GenerateResponse>({
    method: 'POST',
    url: '/ai/generate',
    data: params,
    customTimeout: 60000,
  })
  if (res.code !== 0) {
    throw new Error(res.message || 'AI 服务请求失败')
  }
  if (!res.data) {
    throw new Error('AI 服务响应异常')
  }
  return res.data.text
}
