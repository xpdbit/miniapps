import axios from 'axios'

/* ========================================================================
 *  AI Provider 配置 — 从 Dashboard Admin API 获取
 *  提供向后兼容：Admin API 不可用时自动降级到环境变量
 *  ======================================================================== */

interface AiProviderConfig {
  provider: string
  name: string
  apiKey?: string
  baseUrl?: string
  config?: {
    qpsLimit?: number
    hourlyLimit?: number
    dailyLimit?: number
    weight?: number
    fallbackProviders?: string[]
  }
  isActive: boolean
}

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3001/api/v1'

/**
 * Fetch all active AI provider configs from Dashboard Admin API
 */
export async function fetchProviderConfigs(): Promise<AiProviderConfig[]> {
  try {
    const response = await axios.get(`${ADMIN_API_URL}/admin/ai-manager/public`, {
      timeout: 5000,
    })
    return response.data?.data?.providers || []
  } catch (err) {
    console.warn('[admin-config] Failed to fetch provider configs from admin API:', (err as Error).message)
    return []
  }
}

/**
 * Fetch a specific provider's config
 */
export async function fetchProviderConfig(provider: string): Promise<AiProviderConfig | null> {
  const configs = await fetchProviderConfigs()
  return configs.find(c => c.provider === provider) || null
}

/**
 * Get API key for a provider from dashboard admin config
 * Returns the stored key or null if not found
 */
export async function getProviderApiKey(provider: string): Promise<string | null> {
  const config = await fetchProviderConfig(provider)
  return config?.apiKey || null
}

/**
 * Get base URL for a provider from dashboard admin config
 * Returns overridden URL or the default one if not set
 */
export async function getProviderBaseUrl(provider: string): Promise<string | null> {
  const config = await fetchProviderConfig(provider)
  return config?.baseUrl || null
}
