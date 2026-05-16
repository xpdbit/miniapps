import adminApiClient from './adminApiClient'

// --- Types ---

/** 服务健康状态 */
export type ServiceStatus = 'healthy' | 'degraded' | 'down'

/** 单体服务健康信息 */
export interface ServiceHealth {
  name: string
  status: ServiceStatus
  responseTime: number
  lastCheck: string
}

/** 项目整体健康信息 */
export interface ProjectHealth {
  projectId: number
  projectName: string
  status: ServiceStatus
  responseTime: number
  lastCheck: string
  services: ServiceHealth[]
}

/** QPS 数据点 */
export interface QpsPoint {
  time: string
  value: number
}

/** 响应时间多分位点 */
export interface ResponseTimePoint {
  time: string
  p50: number
  p95: number
  p99: number
}

/** 错误率数据点 */
export interface ErrorRatePoint {
  time: string
  rate: number
}

/** 在线用户数据点 */
export interface OnlineUsersPoint {
  time: string
  count: number
}

/** 监控指标聚合 */
export interface MonitorMetrics {
  qps: QpsPoint[]
  responseTimes: ResponseTimePoint[]
  errorRate: ErrorRatePoint[]
  onlineUsers: OnlineUsersPoint[]
}

/** 告警规则 */
export interface AlertRule {
  name: string
  condition: string
  severity: 'warning' | 'error' | 'critical'
  description: string
}

/** 系统资源指标 */
export interface SystemMetrics {
  cpu: {
    model: string
    cores: number
    loadAvg1m: number
    loadAvg5m: number
    loadAvg15m: number
    usagePercent: number
  }
  memory: {
    total: number
    used: number
    free: number
    percent: number
  }
  disk: {
    total: number
    used: number
    free: number
    percent: number
  }
  uptime: number
  process: {
    nodeVersion: string
    pid: number
    memoryUsage: number
  }
}

// --- API ---

export const monitorApi = {
  /** 获取所有项目的健康状态 */
  getProjectsHealth: () =>
    adminApiClient.get<{ success: boolean; data: ProjectHealth[] }>('/admin/monitoring/health'),

  /** 获取指定项目的详细指标 */
  getProjectMetrics: (projectId: number) =>
    adminApiClient.get<{ success: boolean; data: MonitorMetrics }>(`/admin/monitoring/metrics/${projectId}`),

  /** 获取告警规则 */
  getAlertRules: () =>
    adminApiClient.get<{ success: boolean; data: AlertRule[] }>('/admin/monitoring/alert-rules'),

  /** 获取系统资源指标 */
  getSystemMetrics: () =>
    adminApiClient.get<{ success: boolean; data: SystemMetrics }>('/admin/monitoring/system-metrics'),
}
