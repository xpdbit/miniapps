# AI 配置统一化与限流落地 — 设计文档

> **状态**: designed | **日期**: 2026-05-29 | **作者**: Sisyphus Pro

## 动机

当前 AI API 配置存在以下问题：

| 痛点 | 现状 |
|------|------|
| **配置分散** | `.env.secrets` → 各服务 `.env` → Dashboard DB → 硬编码列表，4 层维护 |
| **Provider 双写** | Dashboard `DEFAULT_PROVIDERS`(11个) + Tavern `PROVIDER_CONFIGS`(11个) 需手动同步 |
| **限流配置脱节** | Dashboard 配了 QPS/权重但无人执行 |
| **前端配置过多** | 4 个页面各有模型选择器，用户实际只需 1 个 AI |
| **用户 Key 不安全** | AES-256-GCM 单一密钥，彩虹表可攻击 |

## 目标

1. Dashboard 作为 **唯一配置源**，Tavern Server 动态拉取
2. Dashboard 的 QPS/小时/日限配置 **真正落地执行**
3. 用户私钥采用 **PBKDF2 + 独立盐 + AES-256-GCM** 加密
4. 前端 **仅个人页** 保留 AI 配置（Provider + Model + Key 三件套），其他页面只读展示
5. ai-proxy 删除硬编码，瘦身为纯路由层

---

## §1 总体架构

```
                    ┌──────────────────────────┐
                    │    Dashboard（管理员）      │
                    │  AiManager 管理 11 个Provider│
                    │  · Key/URL/QPS/权重/回退链  │
                    └───────────┬──────────────┘
                                │ GET /public (60s 轮询)
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    Tavern Server                           │
│                                                           │
│  config-provider.service.ts  ← Dashboard→Redis→内存→Env   │
│           │                                               │
│           ▼                                               │
│  rate-limiter.service.ts  ← Redis 滑动窗口(QPS/H/D)       │
│           │                                               │
│           ▼                                               │
│  ai-proxy.service.ts  ← 纯路由层（瘦身到 ~150 行）         │
│           │                                               │
│           ▼                                               │
│  crypto.ts  ← PBKDF2+Salt+AES-256-GCM（用户Key）           │
│                                                           │
│  🆕 GET /api/v1/models  ← 前端获取可选模型列表             │
└──────────────────────────┬────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────┐
│                  Tavern Client                             │
│                                                           │
│  个人页（唯一 AI 配置入口）                                 │
│  ┌─────────────────────────────────────┐                  │
│  │  服务商  [DeepSeek ▼]               │                  │
│  │  模型    [deepseek-chat ▼]          │                  │
│  │  API Key [••••••••]   (付费时需要)   │                  │
│  └─────────────────────────────────────┘                  │
│                                                           │
│  其他页面：只读展示当前模型，不可修改                         │
│  · 角色详情 · 游戏设置 · 方案详情                            │
└───────────────────────────────────────────────────────────┘
```

---

## §2 数据模型变更

### 2.1 Dashboard 侧 — `dashboard_ai_providers` 表

`config` JSON 字段标准化：

```typescript
interface ProviderConfig {
  // 已有
  qpsLimit?: number          // 每秒上限
  hourlyLimit?: number       // 每小时上限
  dailyLimit?: number        // 每日上限
  weight?: number            // 负载均衡权重
  fallbackProviders?: string[] // 回退链

  // 🆕 新增
  priority?: number          // 路由优先级（低值优先）
  models?: string[]          // 此 Provider 支持的模型 ID
  apiFormat?: 'openai' | 'anthropic' | 'google' // API 格式
}
```

### 2.2 Tavern 侧 — `ModelMeta` 表

```prisma
model TavernModelMeta {
  modelId         String   @id
  displayName     String
  provider        String        // ← 关联到 Dashboard provider 标识
  description     String?
  icon            String?
  minTier         UserTierType  @default(FREE)
  minLevel        Int           @default(1)
  quotaCost       Int           @default(1)
  isActive        Boolean       @default(true)
  sortOrder       Int           @default(0)

  // 🆕 新增
  providerModelId String?       // Provider 侧的模型名
  isFree          Boolean       @default(false) // 是否免费通道
  maxTokens       Int?          // 最大 token 数

  @@index([provider, isActive])
  @@map("ModelMeta")
}
```

### 2.3 Tavern 侧 — `TavernApiKey` 表

```prisma
model TavernApiKey {
  id         String    @id @default(uuid())
  userUuid   String    @map("user_uuid")
  provider   String
  keyValue   String    @db.Text    @map("key_value") // 加密后的值
  baseUrl    String?   @db.Text    @map("base_url")
  isActive   Boolean   @default(true) @map("is_active")
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  // 🆕 盐加密字段
  salt       String    @db.VarChar(32) // PBKDF2 salt (base64)
  iv         String    @db.VarChar(24) // AES IV (base64)

  @@unique([userUuid, provider])
  @@map("ApiKey")
}
```

---

## §3 config-provider.service.ts（Dashboard → Tavern 桥梁）

**文件**: `apps/tavern/server/src/services/config-provider.service.ts`（🆕 新增）

```typescript
class ConfigProviderService {
  private cache: ProviderConfig[] = []
  private lastFetch = 0
  private readonly TTL = 60_000 // 60s

  async getProviders(): Promise<ProviderConfig[]> {
    // 1. Dashboard 可用 → 拉取 → 写 Redis + 内存
    // 2. Dashboard 不可用 → Redis 缓存
    // 3. Redis 也无 → 内存缓存
    // 4. 内存为空 → .env 种子（3 个免费 Provider）+ 告警

    if (Date.now() - this.lastFetch < this.TTL) return this.cache

    try {
      const res = await axios.get(`${ADMIN_API_URL}/admin/ai-manager/public`)
      this.cache = res.data.data.providers
      await redis.set('ai:providers', JSON.stringify(this.cache), 'EX', 300)
      this.lastFetch = Date.now()
    } catch {
      const fromRedis = await redis.get('ai:providers')
      if (fromRedis) { this.cache = JSON.parse(fromRedis); return this.cache }
      if (this.cache.length > 0) return this.cache
      console.error('[ConfigProvider] Dashboard 不可用，降级到环境变量种子')
      this.cache = getEnvFallbackProviders()
    }
    return this.cache
  }

  async warmup(): Promise<void> {
    await this.getProviders()
  }

  async getProvidersForModel(modelId: string): Promise<ProviderConfig[]> {
    const all = await this.getProviders()
    return all
      .filter(p => p.isActive)
      .filter(p => !p.models || p.models.includes(modelId))
      .sort((a, b) => (a.config?.weight ?? 1) - (b.config?.weight ?? 1))
  }
}
```

**降级链路**：Dashboard API → Redis(5min TTL) → 内存缓存 → Env 种子（仅 3 个免费 Provider）

**Env 种子**（最后防线）：
- `TONGYI_API_KEY` / `OPENCODE_API_KEY` / `DEEPSEEK_API_KEY`
- 不再需要 `OPENCODE_BASE_URL` 等，统一从 Dashboard 读取

---

## §4 rate-limiter.service.ts（Provider 级限流执行）

**文件**: `apps/tavern/server/src/services/rate-limiter.service.ts`（🆕 新增）

```typescript
class RateLimiterService {
  /**
   * Redis 滑动窗口
   * Key: ai:ratelimit:{provider}:{qps|hourly|daily}:{timestamp}
   */
  async checkLimit(provider: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const config = await configProvider.getProviderConfig(provider)
    if (!config?.qpsLimit && !config?.dailyLimit) return { allowed: true }

    const [qpsOk, hourlyOk, dailyOk] = await Promise.all([
      this.checkWindow(provider, 'qps',    config.qpsLimit,    1),
      this.checkWindow(provider, 'hourly', config.hourlyLimit, 3600),
      this.checkWindow(provider, 'daily',  config.dailyLimit,  86400),
    ])

    if (!qpsOk)    return { allowed: false, retryAfter: 1 }
    if (!hourlyOk) return { allowed: false, retryAfter: 3600 }
    if (!dailyOk)  return { allowed: false, retryAfter: 86400 }

    await Promise.all([
      this.incr(provider, 'qps'),
      this.incr(provider, 'hourly'),
      this.incr(provider, 'daily'),
    ])
    return { allowed: true }
  }
}
```

**在 ai-proxy 中的调用**：

```typescript
async function selectProvider(modelId: string): Promise<Provider> {
  const providers = await configProvider.getProvidersForModel(modelId)
  for (const p of providers) {
    const { allowed } = await rateLimiter.checkLimit(p.provider)
    if (!allowed) continue // 超限 → 下一个 Provider
    return p
  }
  throw new Error('所有 Provider 均超限或不可用')
}
```

---

## §5 用户私钥盐加密

**文件**: `apps/tavern/server/src/utils/crypto.ts`（✏️ 改造）

```typescript
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto'

const MASTER_KEY = process.env.ENCRYPTION_KEY!   // 服务端持有
const PBKDF2_ITERATIONS = 100_000

function deriveKey(salt: Buffer): Buffer {
  return pbkdf2Sync(MASTER_KEY, salt, PBKDF2_ITERATIONS, 32, 'sha256')
}

export function encryptApiKey(plaintext: string): { encrypted: string; salt: string; iv: string } {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: Buffer.concat([encrypted, tag]).toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
  }
}

export function decryptApiKey(encrypted: string, salt: string, iv: string): string {
  const key = deriveKey(Buffer.from(salt, 'base64'))
  const data = Buffer.from(encrypted, 'base64')
  const tag = data.subarray(-16)
  const ciphertext = data.subarray(0, -16)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
```

**安全性对比**：

| | 旧方案 | 新方案 |
|------|--------|--------|
| 攻击面 | `ENCRYPTION_KEY` 泄露→全部破解 | 需同时获取 MASTER_KEY + 每用户 salt |
| 暴力破解 | 直接试 Key | 每用户独立，100k 次 PBKDF2 |
| 彩虹表 | 可行（同 Key 加密） | 不可行（每用户不同 salt） |

**兼容性**：crypto.ts 保留旧 `encrypt/decrypt` 函数，新增 `encryptApiKey/decryptApiKey`。旧数据读取时若无 salt/iv 字段则走旧解密路径。

---

## §6 ai-proxy.service.ts 重构

**文件**: `apps/tavern/server/src/services/ai-proxy.service.ts`（✏️ 瘦身）

**删除**：
- `PROVIDER_CONFIGS` 常量 → `configProvider.getProviders()`
- `MODEL_PROVIDERS` 映射 → `configProvider.getProvidersForModel(modelId)`
- `FREE_PROVIDER_CHAIN` → Dashboard `fallbackProviders` 配置

**保留**（纯路由层，~150 行）：
1. `selectProvider(modelId)` — 按权重 + 限流筛选
2. `buildRequest(modelId, provider)` — 按 apiFormat 组装请求
3. `streamChat(request, res)` — SSE 流式透传

---

## §7 前端简化

### 7.1 个人页（唯一配置入口）

**文件**: `apps/tavern/client/src/pages/profile/index.tsx`（✏️ 简化）

```
改前：12 个 Provider 的 Key 管理 + Model 选择 + 隐私模式 + 暗色模式
改后：
  ┌──────────────────────────────┐
  │ AI 模型配置                    │
  │                              │
  │ 服务商 [DeepSeek ▼] (自定义)  │  ← GET /api/v1/models/providers
  │ 模型   [deepseek-chat ▼]     │  ← GET /api/v1/models?provider=deepseek
  │ API Key [••••••••]  (付费时)  │  ← POST /api/v1/keys
  └──────────────────────────────┘
```

- Provider 下拉从 API 动态加载（不再硬编码 12 个）
- Model 下拉根据所选 Provider 动态加载
- API Key 仅一个输入框（匹配已选 Provider）
- 删除 12 个 Provider 的 Key 列表 UI
- 删除隐私模式开关（用户自配 Key 时自然直连）

### 7.2 其他页面（只读展示）

**角色详情 / 游戏设置 / 方案详情**：
- 删除 `<ModelSelector>` 组件
- 新增只读文本：`当前模型：DeepSeek Chat`（从 `chatStore` 读取）
- 提供跳转链接：「更换模型 →」跳转到个人页

### 7.3 新增 API

```
GET /api/v1/models              → 返回可用模型列表（按用户等级过滤）
GET /api/v1/models/providers    → 返回可选 Provider 列表
```

---

## §8 迁移计划

```
Phase 1 ─── config-provider.service.ts（🆕 新增）
            并行运行：env 和 Dashboard 同时生效
            验证：日志输出 Provider 来源
            ⏱ 1-2h

Phase 2 ─── rate-limiter.service.ts（🆕 新增）
            先独立验证 Redis 计数器
            再接入 ai-proxy
            ⏱ 1-2h

Phase 3 ─── 用户 Key 盐加密（crypto.ts + DB 迁移）
            旧格式兼容读取
            ⏱ 1-2h

Phase 4 ─── ai-proxy 瘦身 + 前端简化
            一次性切换，feature flag 可回退
            ⏱ 2-3h
```

**不中断策略**：Phase 1-3 纯新增，Phase 4 集中切换。

---

## §9 文件变更清单

| 文件 | 操作 | Phase |
|------|------|:---:|
| `tavern/server/src/services/config-provider.service.ts` | 🆕 | P1 |
| `tavern/server/src/services/rate-limiter.service.ts` | 🆕 | P2 |
| `tavern/server/src/utils/crypto.ts` | ✏️ | P3 |
| `tavern/server/prisma/schema.prisma` | ✏️ | P3 |
| `tavern/server/src/services/ai-proxy.service.ts` | ✏️ 瘦身 | P4 |
| `tavern/server/src/config/index.ts` | ✏️ | P4 |
| `tavern/server/.env.example` | ✏️ | P4 |
| `tavern/server/src/routes/models.ts` | 🆕 | P4 |
| `dashboard/server/admin-ai-manager.ts` | ✏️ | P1 |
| `tavern/client/src/pages/profile/index.tsx` | ✏️ 简化 | P4 |
| `tavern/client/src/pages/character/detail/index.tsx` | ✏️ 删 ModelSelector | P4 |
| `tavern/client/src/pages/game-setup/index.tsx` | ✏️ 删 ModelSelector | P4 |
| `tavern/client/src/pages/scheme-detail/index.tsx` | ✏️ 删 ModelSelector | P4 |
| `tavern/client/src/services/aiClient.ts` | ✏️ 删硬编码 | P4 |
| `tavern/client/src/stores/privacyStore.ts` | ✏️ 简化 | P4 |

---

## §10 注意事项

1. **Dashboard 仅管理员使用**，终端用户不接触 Dashboard
2. **免费 Provider**（tongyi/opencode/deepseek）使用官方 Key，用户无需输入
3. **付费 Provider** 需要用户在个人页输入自己的 Key，走盐加密存储
4. **Env 种子**仅保留 3 个免费 Provider 的 Key 作为最后防线
5. **FTG 暂不接入**本次统一化，保持现有 env 配置方式
6. **CSS `market-*` 重命名**延后到独立 PR，不在本次范围内
