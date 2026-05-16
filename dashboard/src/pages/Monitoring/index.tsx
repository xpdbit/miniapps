import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Col,
  Row,
  Typography,
  Badge,
  Button,
  Statistic,
  Drawer,
  Descriptions,
  Empty,
  Tag,
  Spin,
  Progress,
} from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { useResponsiveWidth } from '@/hooks/useResponsiveWidth'
import { MODAL_WIDTH } from '@/constants/layout'
import { Line, Gauge } from '@ant-design/charts'
import { PageSkeleton } from '@/components/PageSkeleton'
import dayjs from 'dayjs'
import { monitorApi } from '@/services/monitorApi'
import type { ProjectHealth, AlertRule, SystemMetrics } from '@/services/monitorApi'

const { Text } = Typography

/** 自动刷新间隔 (30s) */
const REFETCH_INTERVAL = 30_000

/** 图表统一高度 */
const CHART_HEIGHT = 260

/** 状态 → 颜色/文本 映射 */
const STATUS_CONFIG = {
  healthy: { color: '#52c41a', text: '正常' },
  degraded: { color: '#faad14', text: '亚健康' },
  down: { color: '#ff4d4f', text: '离线' },
} as const

/** 严重级别颜色映射 */
const SEVERITY_COLOR: Record<string, string> = {
  warning: '#faad14',
  error: '#ff4d4f',
  critical: '#cf1322',
}

const SEVERITY_TEXT: Record<string, string> = {
  warning: '警告',
  error: '危险',
  critical: '严重',
}

/** 空数据占位图 (带高度) */
const ChartEmptyState = ({ height = CHART_HEIGHT }: { height?: number }) => (
  <div
    style={{
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Empty description="暂无数据" />
  </div>
)

const Monitoring = () => {
  const queryClient = useQueryClient()

  // --- 状态 ---
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const drawerWidth = useResponsiveWidth(MODAL_WIDTH)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailProject, setDetailProject] = useState<ProjectHealth | null>(null)

  // --- 查询: 所有项目健康状态 ---
  const {
    data: projectsHealth = [],
    isLoading: healthLoading,
  } = useQuery({
    queryKey: ['monitoring', 'health'],
    queryFn: () => monitorApi.getProjectsHealth().then((res) => res.data.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // 自动选中第一个项目
  const effectiveProjectId = useMemo<number | undefined>(() => {
    if (selectedProjectId != null) return selectedProjectId
    return projectsHealth[0]?.projectId
  }, [projectsHealth, selectedProjectId])

  // --- 查询: 选中项目的详细指标 ---
  const {
    data: metrics,
    isLoading: metricsLoading,
  } = useQuery({
    queryKey: ['monitoring', 'metrics', effectiveProjectId],
    queryFn: () => {
      if (effectiveProjectId == null) return Promise.reject(new Error('未选择项目'))
      return monitorApi.getProjectMetrics(effectiveProjectId).then((res) => res.data.data)
    },
    enabled: effectiveProjectId != null,
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 查询: 告警规则 ---
  const { data: alertRules = [] } = useQuery({
    queryKey: ['monitoring', 'alert-rules'],
    queryFn: () => monitorApi.getAlertRules().then((res) => res.data.data),
    staleTime: 5 * 60 * 1000,
  })

  // --- 查询: 系统资源指标 ---
  const { data: systemMetrics, isLoading: sysMetricsLoading } = useQuery<SystemMetrics>({
    queryKey: ['monitoring', 'system-metrics'],
    queryFn: () => monitorApi.getSystemMetrics().then((res) => res.data.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 默认告警规则 (API 无数据时回退) ---
  const displayRules: AlertRule[] = useMemo(() => {
    if (alertRules.length > 0) return alertRules
    return [
      {
        name: '错误率过高',
        condition: '错误率 > 5%',
        severity: 'warning',
        description: '服务处于亚健康状态，建议检查日志',
      },
      {
        name: '服务离线',
        condition: '服务无响应',
        severity: 'critical',
        description: '服务完全不可用，需要立即处理',
      },
      {
        name: '响应时间过长',
        condition: '平均响应时间 > 3s',
        severity: 'warning',
        description: '响应时间超过阈值，可能影响用户体验',
      },
    ]
  }, [alertRules])

  // --- 衍生数据 ---

  /** 当前选中项目名称 */
  const selectedProjectName = useMemo(
    () => projectsHealth.find((p) => p.projectId === effectiveProjectId)?.projectName ?? '项目',
    [projectsHealth, effectiveProjectId],
  )

  /** 响应时间数据 → 多线图格式 */
  const responseTimeData = useMemo(() => {
    if (!metrics?.responseTimes) return []
    return metrics.responseTimes.flatMap((d) => [
      { time: d.time, value: d.p50, type: 'P50' },
      { time: d.time, value: d.p95, type: 'P95' },
      { time: d.time, value: d.p99, type: 'P99' },
    ])
  }, [metrics?.responseTimes])

  /** 最新错误率 */
  const latestErrorRate = useMemo(() => {
    if (!metrics?.errorRate || metrics.errorRate.length === 0) return 0
    const last = metrics.errorRate[metrics.errorRate.length - 1]
    return last?.rate ?? 0
  }, [metrics?.errorRate])

  /** 最新在线用户数 */
  const latestOnlineUsers = useMemo(() => {
    if (!metrics?.onlineUsers || metrics.onlineUsers.length === 0) return 0
    const last = metrics.onlineUsers[metrics.onlineUsers.length - 1]
    return last?.count ?? 0
  }, [metrics?.onlineUsers])

  // --- 事件处理 ---

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['monitoring'] })
  }, [queryClient])

  const handleSelectProject = useCallback((id: number) => {
    setSelectedProjectId(id)
  }, [])

  const openDrawer = useCallback((project: ProjectHealth) => {
    setDetailProject(project)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setDetailProject(null)
  }, [])

  // ============================================================
  //  渲染: 服务健康卡片
  // ============================================================
  const renderHealthCards = () => {
    if (healthLoading && projectsHealth.length === 0) {
      return <PageSkeleton type="dashboard" />
    }

    if (projectsHealth.length === 0 && !healthLoading) {
      return (
        <Card>
          <Empty description="暂无项目监控数据" />
        </Card>
      )
    }

    return (
      <Row gutter={[16, 16]}>
        {projectsHealth.map((project) => {
          const cfg = STATUS_CONFIG[project.status]
          const statusColor = cfg?.color ?? '#999'
          const statusText = cfg?.text ?? project.status
          const isSelected = project.projectId === effectiveProjectId

          return (
            <Col key={project.projectId} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => handleSelectProject(project.projectId)}
                style={{
                  borderLeft: `4px solid ${statusColor}`,
                  cursor: 'pointer',
                  ...(isSelected ? { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' } : {}),
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 16 }}>
                      {project.projectName}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Badge color={statusColor} text={statusText} />
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        响应: {project.responseTime}ms
                      </Text>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        检查: {dayjs(project.lastCheck).format('HH:mm:ss')}
                      </Text>
                    </div>
                  </div>
                  <Button
                    type="link"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      openDrawer(project)
                    }}
                  >
                    详情
                  </Button>
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>
    )
  }

  // ============================================================
  //  渲染: 实时指标
  // ============================================================
  const renderMetrics = () => {
    const showLoading = metricsLoading && !metrics
    const noMetrics = !metricsLoading && !healthLoading && !metrics

    return (
      <>
        {/* 第一行: QPS + 错误率 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={`QPS (${selectedProjectName})`}>
              {showLoading ? (
                <ChartEmptyState />
              ) : noMetrics || !metrics?.qps || metrics.qps.length === 0 ? (
                <ChartEmptyState />
              ) : (
                <Spin spinning={metricsLoading}>
                  <Line
                    data={metrics.qps}
                    xField="time"
                    yField="value"
                    height={CHART_HEIGHT}
                    autoFit
                    shape="smooth"
                    point={{ size: 2, shape: 'circle' }}
                  />
                </Spin>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={`错误率 (${selectedProjectName})`}>
              {showLoading ? (
                <ChartEmptyState />
              ) : noMetrics ? (
                <ChartEmptyState />
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Gauge data={latestErrorRate / 100} height={CHART_HEIGHT} />
                  <div style={{ marginTop: -8 }}>
                    <Text
                      strong
                      style={{
                        fontSize: 24,
                        color: latestErrorRate > 5 ? '#faad14' : '#52c41a',
                      }}
                    >
                      {latestErrorRate.toFixed(1)}%
                    </Text>
                    <div>
                      <Text type="secondary">最近错误率</Text>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 第二行: 响应时间 + 在线用户 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={`响应时间 P50 / P95 / P99 (${selectedProjectName})`}>
              {showLoading ? (
                <ChartEmptyState />
              ) : noMetrics || responseTimeData.length === 0 ? (
                <ChartEmptyState />
              ) : (
                <Spin spinning={metricsLoading}>
                  <Line
                    data={responseTimeData}
                    xField="time"
                    yField="value"
                    seriesField="type"
                    height={CHART_HEIGHT}
                    autoFit
                    shape="smooth"
                    color={['#1677ff', '#faad14', '#ff4d4f']}
                    legend={{
                      color: { position: 'top' },
                    }}
                    point={{ size: 2, shape: 'circle' }}
                    style={{ lineWidth: 2 }}
                  />
                </Spin>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={`在线用户 (${selectedProjectName})`}>
              {showLoading ? (
                <ChartEmptyState height={CHART_HEIGHT} />
              ) : (
                <div
                  style={{
                    height: CHART_HEIGHT,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Statistic
                    value={latestOnlineUsers}
                    prefix={<TeamOutlined />}
                    valueStyle={{ fontSize: 48, color: '#1677ff' }}
                    suffix="人"
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      {metrics?.onlineUsers && metrics.onlineUsers.length > 0
                        ? `最近更新: ${dayjs(
                            metrics.onlineUsers[metrics.onlineUsers.length - 1]?.time,
                          ).format('HH:mm:ss')}`
                        : '暂无在线数据'}
                    </Text>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </>
    )
  }

  // ============================================================
  //  渲染: 告警规则
  // ============================================================
  const renderAlertRules = () => (
    <Card title="告警规则" style={{ marginTop: 24 }}>
      {displayRules.length === 0 ? (
        <Empty description="暂无告警规则" />
      ) : (
        <Row gutter={[16, 16]}>
          {displayRules.map((rule, idx) => {
            const severityColor = SEVERITY_COLOR[rule.severity] ?? '#999'
            const severityText = SEVERITY_TEXT[rule.severity] ?? rule.severity
            return (
              <Col key={idx} xs={24} sm={12} lg={8}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    border: `1px solid ${severityColor}20`,
                    backgroundColor: `${severityColor}08`,
                  }}
                >
                  <SpaceBetween>
                    <Text strong>{rule.name}</Text>
                    <Tag color={severityColor}>{severityText}</Tag>
                  </SpaceBetween>
                  <div style={{ marginTop: 8 }}>
                    <Text code style={{ fontSize: 13 }}>
                      {rule.condition}
                    </Text>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {rule.description}
                    </Text>
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>
      )}
    </Card>
  )

  // ============================================================
  //  渲染: 服务详情抽屉
  // ============================================================
  const renderDrawer = () => {
    if (!detailProject) return null
    const statusColor = STATUS_CONFIG[detailProject.status]?.color ?? '#999'

    return (
      <Drawer
        title={
          <SpaceBetween>
            <span>{detailProject.projectName} - 服务详情</span>
            <Badge color={statusColor} text={STATUS_CONFIG[detailProject.status]?.text ?? detailProject.status} />
          </SpaceBetween>
        }
        open={drawerOpen}
        onClose={closeDrawer}
        width={drawerWidth}
      >
        {detailProject.services.length === 0 ? (
          <Empty description="暂无服务详情" />
        ) : (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
            {detailProject.services.map((svc) => {
              const svcColor = STATUS_CONFIG[svc.status]?.color ?? '#999'
              const svcText = STATUS_CONFIG[svc.status]?.text ?? svc.status
              return (
                <Descriptions.Item
                  key={svc.name}
                  label={
                    <Text strong style={{ fontSize: 14 }}>
                      {svc.name}
                    </Text>
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Badge color={svcColor} text={svcText} />
                    {svc.responseTime >= 0 && (
                      <Text style={{ fontSize: 13 }}>
                        响应时间: {svc.responseTime}ms
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      最近检测: {dayjs(svc.lastCheck).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </div>
                </Descriptions.Item>
              )
            })}
          </Descriptions>
        )}

        <div style={{ marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            项目 ID: {detailProject.projectId}
          </Text>
        </div>
      </Drawer>
    )
  }

  // ============================================================
  //  主渲染
  // ============================================================
  return (
    <div style={{ padding: 24 }}>
      {/* 头部 */}
      <PageHeader
        title="系统监控"
        onRefresh={handleRefresh}
        extra={<Tag color="blue">30s 自动刷新</Tag>}
      />

      {/* 服务健康卡片 */}
      {renderHealthCards()}

      {/* 实时指标 */}
      {projectsHealth.length > 0 && (
        <div style={{ marginTop: 24 }}>{renderMetrics()}</div>
      )}

      {/* 告警规则 */}
      {renderAlertRules()}

      {/* ── 系统资源监控 ── */}
      {systemMetrics && (
        <Card title="系统资源" style={{ marginTop: 24 }}>
          <Spin spinning={sysMetricsLoading}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Statistic
                    title="CPU 使用率"
                    value={systemMetrics.cpu.usagePercent}
                    suffix="%"
                    valueStyle={{ color: systemMetrics.cpu.usagePercent > 80 ? '#ff4d4f' : '#52c41a' }}
                  />
                  <Progress
                    percent={systemMetrics.cpu.usagePercent}
                    showInfo={false}
                    strokeColor={systemMetrics.cpu.usagePercent > 80 ? '#ff4d4f' : '#1677ff'}
                    style={{ marginTop: 8 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {systemMetrics.cpu.cores} 核 · Load: {systemMetrics.cpu.loadAvg1m}
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Statistic
                    title="内存使用率"
                    value={systemMetrics.memory.percent}
                    suffix="%"
                    valueStyle={{ color: systemMetrics.memory.percent > 85 ? '#ff4d4f' : '#1677ff' }}
                  />
                  <Progress
                    percent={systemMetrics.memory.percent}
                    showInfo={false}
                    strokeColor={systemMetrics.memory.percent > 85 ? '#ff4d4f' : '#52c41a'}
                    style={{ marginTop: 8 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Statistic
                    title="磁盘使用率"
                    value={systemMetrics.disk.percent || 0}
                    suffix="%"
                    valueStyle={{ color: (systemMetrics.disk.percent || 0) > 85 ? '#ff4d4f' : '#1677ff' }}
                  />
                  <Progress
                    percent={systemMetrics.disk.percent || 0}
                    showInfo={false}
                    strokeColor={(systemMetrics.disk.percent || 0) > 85 ? '#ff4d4f' : '#52c41a'}
                    style={{ marginTop: 8 }}
                  />
                  {systemMetrics.disk.total > 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatBytes(systemMetrics.disk.used)} / {formatBytes(systemMetrics.disk.total)}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>未获取到磁盘信息</Text>
                  )}
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Statistic
                    title="运行时间"
                    value={formatUptime(systemMetrics.uptime)}
                    valueStyle={{ fontSize: 20 }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Node {systemMetrics.process.nodeVersion} · PID {systemMetrics.process.pid}
                    </Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </Spin>
        </Card>
      )}

      {/* 服务详情抽屉 */}
      {renderDrawer()}
    </div>
  )
}

// ---- 内联辅助组件 ----

/** 格式化字节为人类可读格式 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/** 格式化运行时间 */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * 弹性行内两端对齐，常用于标题行
 */
const SpaceBetween = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    {children}
  </div>
)

export default Monitoring
