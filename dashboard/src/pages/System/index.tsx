import { Card, Col, Row, Typography, Statistic, Alert, Badge, Tag } from 'antd'
import {
  CloudServerOutlined,
  ProjectOutlined,
  ApiOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { monitorApi } from '@/services/monitorApi'
import { useProjectStore } from '@/stores/projectStore'

const { Title, Text } = Typography

/** 格式化 uptime */
const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d} 天`)
  if (h > 0) parts.push(`${h} 小时`)
  if (m > 0) parts.push(`${m} 分钟`)
  return parts.length ? parts.join(' ') : '刚刚启动'
}

const SystemPage = () => {
  const projects = useProjectStore((s) => s.projects)

  // 系统资源指标
  const { data: sysMetrics, isLoading: sysLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => monitorApi.getSystemMetrics(),
    refetchInterval: 30_000,
  })

  // 各项目健康状态
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['projects-health'],
    queryFn: () => monitorApi.getProjectsHealth(),
    refetchInterval: 30_000,
  })

  const sysInfo = sysMetrics?.data?.data
  const projectsHealth = healthData?.data?.data ?? []

  const activeProjects = projects.filter((p) => p.id !== 'system' && p.status === 'active').length
  const totalProjects = projects.filter((p) => p.id !== 'system').length
  const healthyCount = projectsHealth.filter((p) => p.status === 'healthy').length

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>系统概览</Title>

      {/* 平台级统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="管理项目数"
              value={totalProjects}
              prefix={<ProjectOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              活跃 {activeProjects} / 总计 {totalProjects}
            </Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="活跃项目"
              value={activeProjects}
              prefix={<ApiOutlined />}
              valueStyle={{ color: activeProjects > 0 ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="服务健康"
              value={projectsHealth.length > 0 ? `${healthyCount}/${projectsHealth.length}` : '—'}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: healthyCount === projectsHealth.length && projectsHealth.length > 0 ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="服务器运行"
              value={sysInfo?.uptime ? formatUptime(sysInfo.uptime) : '—'}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 系统资源 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统资源" loading={sysLoading}>
            {sysInfo ? (
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Statistic
                    title="CPU 使用率"
                    value={sysInfo.cpu.usagePercent}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: sysInfo.cpu.usagePercent > 80 ? '#ff4d4f' : undefined }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    负载: {sysInfo.cpu.loadAvg1m.toFixed(2)} / {sysInfo.cpu.loadAvg5m.toFixed(2)} / {sysInfo.cpu.loadAvg15m.toFixed(2)}
                  </Text>
                </Col>
                <Col span={8}>
                  <Statistic
                    title="内存使用"
                    value={sysInfo.memory.percent}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: sysInfo.memory.percent > 80 ? '#ff4d4f' : undefined }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="磁盘使用"
                    value={sysInfo.disk.percent}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: sysInfo.disk.percent > 80 ? '#ff4d4f' : undefined }}
                  />
                </Col>
              </Row>
            ) : (
              !sysLoading && <Text type="secondary">等待系统指标数据…</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="进程信息" loading={sysLoading}>
            {sysInfo ? (
              <div>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Text type="secondary">Node.js</Text>
                    <div>{sysInfo.process.nodeVersion}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">PID</Text>
                    <div>{sysInfo.process.pid}</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">进程内存</Text>
                    <div>{(sysInfo.process.memoryUsage / 1024 / 1024).toFixed(1)} MB</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">CPU 核心</Text>
                    <div>{sysInfo.cpu.cores}</div>
                  </Col>
                </Row>
              </div>
            ) : (
              !sysLoading && <Text type="secondary">等待进程信息…</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 服务健康状态 */}
      <Card
        title="服务健康状态"
        loading={healthLoading}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            每 30 秒自动刷新
          </Text>
        }
      >
        {projectsHealth.length === 0 && !healthLoading ? (
          <Alert
            message="健康检查待接入"
            description="服务健康检查依赖 Admin API 的 /api/admin/monitoring/health 端点。如果此端点尚未部署，将显示占位信息。"
            type="info"
            showIcon
          />
        ) : (
          <Row gutter={[16, 16]}>
            {projectsHealth.map((p) => (
              <Col xs={24} sm={12} lg={8} key={p.projectId}>
                <Card size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong>{p.projectName}</Text>
                    <Badge
                      status={p.status === 'healthy' ? 'success' : p.status === 'degraded' ? 'warning' : 'error'}
                      text={p.status === 'healthy' ? '健康' : p.status === 'degraded' ? '降级' : '宕机'}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      响应: {p.responseTime}ms
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      最近检测: {new Date(p.lastCheck).toLocaleTimeString()}
                    </Text>
                  </div>
                  {p.services.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.services.map((s) => (
                        <Tag key={s.name} color={s.status === 'healthy' ? 'success' : s.status === 'degraded' ? 'warning' : 'error'}>
                          {s.name}
                        </Tag>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}

export default SystemPage
