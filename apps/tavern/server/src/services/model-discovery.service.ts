import axios from 'axios'

/* ========================================================================
 *  Model Discovery Service
 *  从各 AI 服务商官方 API 获取可用模型列表
 *  用于替代硬编码的 seed 数据
 *
 *  支持的服务商:
 *    openai, anthropic, google, zhipu, deepseek,
 *    moonshot, minimax, openrouter
 *  ======================================================================== */

export interface DiscoveredModel {
  modelId: string
  displayName: string
  provider: string
}

/* 各提供商官方模型列表 API 配置 */
interface ProviderApiConfig {
  /** API 端点 URL（不含 baseUrl 前缀） */
  endpointPath: string
  /** 认证方式 */
  authType: 'bearer' | 'x-api-key' | 'url-param'
  /** 响应中提取模型的路径 */
  modelListPath: string
  /** 模型 ID 提取路径 */
  modelIdField: string
  /** 模型显示名提取路径（可选，默认取 modelId 值） */
  modelNameField?: string
  /** 是否需要特殊请求头 */
  extraHeaders?: Record<string, string>
  /** 是否需要特殊处理模型 ID */
  transformId?: (id: string) => string
  /** 是否需要特殊处理模型名 */
  transformName?: (name: string, id: string) => string
}

const PROVIDER_API_CONFIGS: Record<string, ProviderApiConfig> = {
  openai: {
    endpointPath: '/v1/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'id',
  },
  deepseek: {
    endpointPath: '/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'id',
  },
  anthropic: {
    endpointPath: '/v1/models',
    authType: 'x-api-key',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'display_name',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  google: {
    endpointPath: '/v1beta/models',
    authType: 'url-param',
    modelListPath: 'models',
    modelIdField: 'name',
    modelNameField: 'displayName',
    /** Google 返回的 name 格式为 "models/gemini-2.5-flash"，去掉 "models/" 前缀 */
    transformId: (name: string) => name.replace(/^models\//, ''),
  },
  zhipu: {
    endpointPath: '/api/paas/v4/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'id',
  },
  moonshot: {
    endpointPath: '/v1/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'id',
  },
  minimax: {
    endpointPath: '/v1/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'id',
  },
  openrouter: {
    endpointPath: '/api/v1/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'name',
  },
  oneapi: {
    endpointPath: '/v1/models',
    authType: 'bearer',
    modelListPath: 'data',
    modelIdField: 'id',
    modelNameField: 'id',
  },
}

/** 各提供商默认 API Base URL */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  moonshot: 'https://api.moonshot.cn',
  minimax: 'https://api.minimaxi.com',
  openrouter: 'https://openrouter.ai/api',
  // One API 无默认 base URL，由用户自定义
}

/**
 * 从指定服务商 API 拉取可用模型列表
 * @param provider 服务商 key（如 'openai', 'deepseek'）
 * @param apiKey   API Key
 * @param baseUrl  可选的自定义 base URL
 * @returns 模型列表
 */
export async function discoverModels(
  provider: string,
  apiKey: string,
  baseUrl?: string,
): Promise<DiscoveredModel[]> {
  const apiConfig = PROVIDER_API_CONFIGS[provider]
  if (!apiConfig) {
    throw new Error(`不支持的服务商: ${provider}`)
  }

  const effectiveBaseUrl = baseUrl || PROVIDER_BASE_URLS[provider]
  if (!effectiveBaseUrl) {
    throw new Error(`未配置 ${provider} 的 Base URL`)
  }

  const url = `${effectiveBaseUrl}${apiConfig.endpointPath}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...apiConfig.extraHeaders,
  }

  switch (apiConfig.authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiKey}`
      break
    case 'x-api-key':
      headers['X-Api-Key'] = apiKey
      break
    // url-param: auth key passed as query parameter
  }

  try {
    // Google 使用 query param 传 key
    const requestUrl = apiConfig.authType === 'url-param'
      ? `${url}?key=${apiKey}`
      : url

    const response = await axios.get(requestUrl, {
      headers,
      timeout: 15000,
      validateStatus: (status) => status < 500,
    })

    if (response.status !== 200) {
      const errMsg = response.data?.error?.message
        || response.data?.error?.code
        || `API 返回状态码 ${response.status}`
      throw new Error(errMsg)
    }

    // 按路径提取模型列表
    const rawModels = resolvePath(response.data, apiConfig.modelListPath) as unknown[]
    if (!Array.isArray(rawModels)) {
      throw new Error(`模型列表格式异常: 期望数组，收到 ${typeof rawModels}`)
    }

    return rawModels
      .map((item: unknown) => {
        const rawItem = item as Record<string, unknown>
        let modelId = resolvePath(rawItem, apiConfig.modelIdField) as string
        let displayName = apiConfig.modelNameField
          ? (resolvePath(rawItem, apiConfig.modelNameField) as string) || modelId
          : modelId

        // 特殊转换
        if (apiConfig.transformId) {
          modelId = apiConfig.transformId(modelId)
        }
        if (apiConfig.transformName) {
          displayName = apiConfig.transformName(displayName, modelId)
        }

        return { modelId, displayName, provider }
      })
      .filter((m: DiscoveredModel) => {
        // 过滤掉非文本生成模型（Google 会返回多种类型）
        if (provider === 'google') {
          // Google models 返回所有类型的模型，只保留支持文本生成的
          return true // 暂不过滤，由客户端选择
        }
        return true
      })
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err
    }
    throw new Error(`发现模型失败: ${String(err)}`)
  }
}

/**
 * 按点号路径从对象中取值
 * 例如 resolvePath({ a: { b: 'c' } }, 'a.b') => 'c'
 */
function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
