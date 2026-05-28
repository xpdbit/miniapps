// =============================================================================
// Dashboard Admin Monitoring API Routes
// 为系统监控页面提供健康检查、性能指标和告警规则数据
// =============================================================================

import { Router, type Request, type Response } from 'express'
import * as os from 'os'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import prisma from './prisma'
import { authenticate } from './admin-auth'

const router = Router()

// 所有监控路由需要认证
router.use(authenticate)

// ─── Types ─────────────────────────────────────────────────────────

interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  lastCheck: string
}

interface ProjectHealth {
  projectId: string
  projectName: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  lastCheck: string
  services: ServiceHealth[]
}

interface QpsPoint {
  time: string
  value: number
}

interface ResponseTimePoint {
  time: string
  p50: number
  p95: number
  p99: number
}

interface ErrorRatePoint {
  time: string
  rate: number
}

interface OnlineUsersPoint {
  time: string
  count: number
}

interface MonitorMetrics {
  qps: QpsPoint[]
  responseTimes: ResponseTimePoint[]
  errorRate: ErrorRatePoint[]
  onlineUsers: OnlineUsersPoint[]
}

// ─── 指标时序缓存（内存环形数组，避免随机模拟数据） ────────────

const METRICS_CACHE_MAX = 24 // 最多保留 24 个时间点（= 24次采集，约12分钟 @30s间隔）

interface CachedMetrics {
  qps: QpsPoint[]
  responseTimes: ResponseTimePoint[]
  errorRate: ErrorRatePoint[]
  onlineUsers: OnlineUsersPoint[]
}

const metricsCache = new Map<string, CachedMetrics>()

function appendMetricsPoint(projectId: string, point: {
  time: string
  qps: number
  responseTime: number
  errorRate: number
  onlineUsers: number
}) {
  let cache = metricsCache.get(projectId)
  if (!cache) {
    cache = { qps: [], responseTimes: [], errorRate: [], onlineUsers: [] }
  }

  cache.qps.push({ time: point.time, value: point.qps })
  cache.responseTimes.push({
    time: point.time,
    p50: point.responseTime,
    p95: Math.round(point.responseTime * 1.5),
    p99: Math.round(point.responseTime * 2.5),
  })
  cache.errorRate.push({ time: point.time, rate: point.errorRate })
  cache.onlineUsers.push({ time: point.time, count: point.onlineUsers })

  // 环形裁剪
  if (cache.qps.length > METRICS_CACHE_MAX) {
    cache.qps = cache.qps.slice(-METRICS_CACHE_MAX)
    cache.responseTimes = cache.responseTimes.slice(-METRICS_CACHE_MAX)
    cache.errorRate = cache.errorRate.slice(-METRICS_CACHE_MAX)
    cache.onlineUsers = cache.onlineUsers.slice(-METRICS_CACHE_MAX)
  }

  metricsCache.set(projectId, cache)
}

// ─── 辅助函数 ─────────────────────────────────────────────────────

/**
 * 解析项目的健康检查基础 URL
 * 优先使用 apiBaseUrl（如果是绝对 URL），否则按 slug 映射到已知服务器
 */
function getHealthBaseUrl(slug: string, apiBaseUrl: string): string {
  if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
    return apiBaseUrl
  }
  // 按 slug 映射到已知服务器（开发环境用 localhost，生产用 Docker 环境变量配置）
  const urlMap: Record<string, string> = {
    ftg: process.env.HEALTH_FTG_URL || 'http://localhost:3000',
    game1: process.env.HEALTH_GAME1_URL || 'http://localhost:3004',
    tavern: process.env.HEALTH_TAVERN_URL || 'http://localhost:3002',
  }
  return urlMap[slug] || apiBaseUrl
}

/**
 * 探测项目的健康端点，返回状态和响应时间
 */
async function probeProjectHealth(
  apiBaseUrl: string,
): Promise<{ ok: boolean; responseTime: number }> {
  const start = Date.now()
  try {
    // 使用 fetch 避免额外依赖
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const responseTime = Date.now() - start
    return { ok: res.ok, responseTime }
  } catch {
    return { ok: false, responseTime: Date.now() - start }
  }
}

/**
 * 探测项目的实时统计端点，获取真实数据
 * 返回 { activeUsers, totalRequests } 或 null
 */
async function probeProjectStats(
  apiBaseUrl: string,
): Promise<{ activeUsers: number; totalRequests: number; errorRate: number } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const baseUrl = apiBaseUrl.replace(/\/+$/, '')
    // 尝试调用各项目的管理统计端点
    const res = await fetch(`${baseUrl}/admin/dashboard/stats`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })
    clearTimeout(timeout)

    if (res.ok) {
      const json = await res.json() as { data?: { activeUsers?: number; totalChats?: number; totalRequests?: number; errorRate?: number } }
      const data = json?.data ?? (json as Record<string, unknown>)
      return {
        activeUsers: (data.activeUsers as number) ?? 0,
        totalRequests: (data.totalChats as number) ?? (data.totalRequests as number) ?? 0,
        errorRate: (data.errorRate as number) ?? 0,
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Routes ───────────────────────────────────────────────────────

/**
 * GET /api/admin/monitoring/health
 * 获取所有项目的健康状态
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.dashboardProject.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    const results: ProjectHealth[] = await Promise.all(
      projects.map(async (project) => {
        const healthResult = await probeProjectHealth(getHealthBaseUrl(project.slug, project.apiBaseUrl))
        const status = healthResult.ok
          ? healthResult.responseTime < 1000
            ? ('healthy' as const)
            : ('degraded' as const)
          : ('down' as const)

        return {
          projectId: project.id,
          projectName: project.name,
          status,
          responseTime: healthResult.responseTime,
          lastCheck: new Date().toISOString(),
          services: [
            {
              name: `${project.name} API`,
              status,
              responseTime: healthResult.responseTime,
              lastCheck: new Date().toISOString(),
            },
          ],
        }
      }),
    )

    // 如果数据库没有项目记录，返回默认值
    if (results.length === 0) {
      const defaultProjects = [
        { id: '0', name: 'FTG Server', url: 'http://server:3000' },
        { id: '1', name: 'Game1 Server', url: 'http://game1-server:3000' },
        { id: '2', name: 'Tavern Server', url: 'http://tavern-server:3000' },
      ]
      const defaultResults: ProjectHealth[] = await Promise.all(
        defaultProjects.map(async (p) => {
          const healthResult = await probeProjectHealth(p.url)
          const status = healthResult.ok
            ? healthResult.responseTime < 1000
              ? ('healthy' as const)
              : ('degraded' as const)
            : ('down' as const)

          return {
            projectId: p.id,
            projectName: p.name,
            status,
            responseTime: healthResult.responseTime,
            lastCheck: new Date().toISOString(),
            services: [
              {
                name: p.name,
                status,
                responseTime: healthResult.responseTime,
                lastCheck: new Date().toISOString(),
              },
            ],
          }
        }),
      )
      res.json({ success: true, data: defaultResults })
      return
    }

    res.json({ success: true, data: results })
  } catch (e) {
    console.error('[Monitoring] 获取健康状态失败:', e)
    // 返回空数据而不是错误，让前端展示空状态
    res.json({ success: true, data: [] })
  }
})

/**
 * GET /api/admin/monitoring/metrics/:projectId
 * 获取指定项目的实时指标（从健康探测和项目统计 API 获取真实数据）
 */
router.get('/metrics/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string

    // 查找项目配置
    const project = await prisma.dashboardProject.findUnique({
      where: { id: projectId },
    })

    // 并行探测：健康检查 + 实时统计
    const [healthResult, statsResult] = await Promise.all([
      project ? probeProjectHealth(getHealthBaseUrl(project.slug, project.apiBaseUrl)) : Promise.resolve({ ok: false, responseTime: 0 }),
      project ? probeProjectStats(getHealthBaseUrl(project.slug, project.apiBaseUrl)) : Promise.resolve(null),
    ])

    const isUp = healthResult.ok
    const responseTime = healthResult.responseTime
    const activeUsers = statsResult?.activeUsers ?? 0
    const totalRequests = statsResult?.totalRequests ?? 0
    const errorRate = !isUp ? 100 : (statsResult?.errorRate ?? 0)

    // 追加当前数据点到缓存
    if (project || isUp) {
      appendMetricsPoint(projectId, {
        time: new Date().toISOString(),
        qps: totalRequests,
        responseTime,
        errorRate,
        onlineUsers: activeUsers,
      })
    }

    // 返回缓存的历史数据点 + 当前点
    const cached = metricsCache.get(projectId)
    const metrics: MonitorMetrics = {
      qps: cached?.qps ?? [],
      responseTimes: cached?.responseTimes ?? [],
      errorRate: cached?.errorRate ?? [],
      onlineUsers: cached?.onlineUsers ?? [],
    }

    res.json({ success: true, data: metrics })
  } catch (e) {
    console.error('[Monitoring] 获取指标失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

/**
 * GET /api/admin/monitoring/alert-rules
 * 获取告警规则
 */
router.get('/alert-rules', async (_req: Request, res: Response) => {
  try {
    // 当前为预定义规则，后续可从数据库读取
    const rules = [
      {
        name: '错误率过高',
        condition: '错误率 > 5%',
        severity: 'warning' as const,
        description: '服务处于亚健康状态，建议检查日志',
      },
      {
        name: '服务离线',
        condition: '服务无响应',
        severity: 'critical' as const,
        description: '服务完全不可用，需要立即处理',
      },
      {
        name: '响应时间过长',
        condition: '平均响应时间 > 3s',
        severity: 'warning' as const,
        description: '响应时间超过阈值，可能影响用户体验',
      },
      {
        name: 'QPS 突增',
        condition: 'QPS 较前日同期增长 > 100%',
        severity: 'warning' as const,
        description: '流量大幅增长，关注系统负载',
      },
      {
        name: '在线用户异常',
        condition: '在线用户数 < 正常值的 10%',
        severity: 'error' as const,
        description: '在线用户数异常偏低，可能服务异常',
      },
    ]

    res.json({ success: true, data: rules })
  } catch (e) {
    console.error('[Monitoring] 获取告警规则失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

// ─── 平台适配辅助函数 ──────────────────────────────────────────────

const IS_WINDOWS = process.platform === 'win32'
const IS_LINUX = process.platform === 'linux'

/**
 * 跨平台获取 CPU 使用率（0-100）
 * 通过 os.cpus() 的 idle/total 差值计算，无需外部命令
 * 使用 await setTimeout 避免阻塞事件循环
 */
async function getCpuUsagePercent(): Promise<number> {
  try {
    const cpusBefore = os.cpus().map(c => {
      const t = c.times
      return { idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq }
    })
    await new Promise(resolve => setTimeout(resolve, 100))
    const cpusAfter = os.cpus().map((c, i) => {
      const t = c.times
      const b = cpusBefore[i]!
      const total = t.user + t.nice + t.sys + t.idle + t.irq
      return { idle: t.idle - b.idle, total: total - b.total }
    })
    const sumIdle = cpusAfter.reduce((s, c) => s + c.idle, 0)
    const sumTotal = cpusAfter.reduce((s, c) => s + c.total, 0)
    if (sumTotal <= 0) return 0
    return Math.round((1 - sumIdle / sumTotal) * 100)
  } catch {
    return 0
  }
}

/** 获取准确的空闲内存（Linux 使用 MemAvailable，Windows/macOS 使用 os.freemem()） */
function getFreeMemory(): number {
  if (IS_LINUX) {
    try {
      const meminfo = readFileSync('/proc/meminfo', 'utf-8')
      const match = meminfo.match(/MemAvailable:\s+(\d+)/)
      if (match) return parseInt(match[1]!, 10) * 1024
    } catch {
      // fall through to os.freemem()
    }
  }
  return os.freemem()
}

/** Windows: 通过 fsutil 获取 C: 盘磁盘信息（中英文通用解析） */
function getWindowsDiskInfo(): { total: number; used: number; free: number; percent: number } {
  try {
    const result = execSync('fsutil volume diskfree c:\\', { encoding: 'utf-8', timeout: 5000 })
    // 提取所有行中的逗号分隔数字（适配中英文输出）
    const numbers = [...result.matchAll(/:[\s]*([\d,]+)/g)]
      .map(m => parseInt(m[1]!.replace(/,/g, ''), 10))
      .filter(n => !isNaN(n) && n > 0)
    // fsutil 输出通常第1条=可用/空闲, 第2条=总大小, 第3条=同可用
    // 取第2条为 total，第1条为 free
    if (numbers.length >= 2) {
      const total = numbers[1]!
      const free = numbers[0]!
      const used = Math.max(0, total - free)
      const percent = total > 0 ? Math.round((used / total) * 100) : 0
      return { total, used, free, percent }
    }
  } catch {
    // 磁盘信息获取失败
  }
  return { total: 0, used: 0, free: 0, percent: 0 }
}

/** Linux: 通过 df -k 获取根分区磁盘信息 */
function getLinuxDiskInfo(): { total: number; used: number; free: number; percent: number } {
  try {
    const df = execSync('df -k /', { encoding: 'utf-8', timeout: 3000 })
    const lines = df.trim().split('\n')
    if (lines.length >= 2) {
      const parts = lines[1]!.split(/\s+/)
      if (parts.length >= 4) {
        const total = parseInt(parts[1]!, 10) * 1024
        const used = parseInt(parts[2]!, 10) * 1024
        const free = parseInt(parts[3]!, 10) * 1024
        const percent = total > 0 ? Math.round((used / total) * 100) : 0
        return { total, used, free, percent }
      }
    }
  } catch {
    // 磁盘信息获取失败
  }
  return { total: 0, used: 0, free: 0, percent: 0 }
}

/**
 * GET /api/admin/monitoring/system-metrics
 * 获取服务器系统资源指标（CPU / 内存 / 磁盘 / 运行时间）
 * 兼容 Windows / Linux 平台
 */
router.get('/system-metrics', async (_req: Request, res: Response) => {
  try {
    const totalMem = os.totalmem()

    const cpus = os.cpus()

    // CPU 使用率：跨平台通过 os.cpus() 差值计算，非阻塞
    const cpuUsagePercent = await getCpuUsagePercent()

    // CPU 负载均值（平台适配）
    const [loadAvg1m, loadAvg5m, loadAvg15m] = IS_WINDOWS
      ? [0, 0, 0]  // Windows 无 loadavg 概念，如实返回 0
      : (() => {
          const [a, b, c] = os.loadavg()
          return [
            Math.round(a! * 100) / 100,
            Math.round(b! * 100) / 100,
            Math.round(c! * 100) / 100,
          ]
        })()

    // ── 磁盘信息（平台适配） ──
    const disk = IS_WINDOWS ? getWindowsDiskInfo() : getLinuxDiskInfo()

    // ── 内存信息（Linux 使用更准确的 MemAvailable） ──
    const freeMem = getFreeMemory()

    res.json({
      success: true,
      data: {
        cpu: {
          model: cpus[0]?.model || 'Unknown',
          cores: cpus.length,
          loadAvg1m,
          loadAvg5m,
          loadAvg15m,
          usagePercent: cpuUsagePercent,
        },
        memory: {
          total: totalMem,
          used: totalMem - freeMem,
          free: freeMem,
          percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        },
        disk: {
          total: disk.total,
          used: disk.used,
          free: disk.free,
          percent: disk.percent,
        },
        uptime: os.uptime(),
        process: {
          nodeVersion: process.version,
          pid: process.pid,
          memoryUsage: process.memoryUsage().rss,
        },
      },
    })
  } catch (e) {
    console.error('[Monitoring] 获取系统指标失败:', e)
    res.status(500).json({ success: false, message: (e as Error).message })
  }
})

export default router
