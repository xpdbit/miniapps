import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Col,
  Empty,
  Row,
  Spin,
  Statistic,
  Typography,
  Space,
  Button,
} from 'antd'
import {
  CheckCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  RiseOutlined,
  UserOutlined,
  TeamOutlined,
  CommentOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { Column, Line, Pie } from '@ant-design/charts'
import { useNavigate } from 'react-router-dom'
import { PageSkeleton } from '@/components/PageSkeleton'
import { dashboardApi } from '@/services/dashboardApi'
import { game1AdminApi } from '@/services/game1'
import { useProjectStore } from '@/stores/projectStore'
import { ROUTES } from '@/constants/routes'
import type { DistributionItem, TrendItem } from '@/services/dashboardApi'
import styles from '@/styles/pages/dashboard.module.scss'

const { Title, Text } = Typography

/** 自动刷新间隔 (30s) */
const REFETCH_INTERVAL = 30_000

/** 图表统一高度 */
const CHART_HEIGHT = 300

/** 统计卡片配置项 */
interface StatCardItem {
  title: string
  value: number | undefined
  icon: React.ReactNode
  valueStyle?: React.CSSProperties
}

/** 空数据占位图 */
const ChartEmptyState = () => (
  <div className={styles.chartEmpty}>
    <Empty description="暂无数据" />
  </div>
)

/** 获取当前选中的项目类型 */
const getProjectType = (projectName: string | undefined): 'ftg' | 'game1' | 'tavern' | 'none' => {
  if (!projectName) return 'none'
  const name = projectName.toLowerCase()
  if (name.includes('ftg') || name.includes('food')) return 'ftg'
  if (name.includes('game1') || name.includes('game')) return 'game1'
  if (name.includes('tavern') || name.includes('ai')) return 'tavern'
  return 'none'
}

// ─── 跨项目全局概览 ───────────────────────────────────

const ProjectOverview = () => {
  const navigate = useNavigate()

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={8}>
        <Card
          hoverable
          onClick={() => navigate(ROUTES.FOOD_RECORDS)}
          styles={{ body: { cursor: 'pointer' } }}
        >
          <Statistic title="FTG" value="食物主题生成器" prefix={<EyeOutlined />} valueStyle={{ fontSize: 14 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>用户管理 · 主题 · 成就 · 密钥</Text>
          <div style={{ marginTop: 8 }}><Button type="link" size="small">进入管理 <ArrowRightOutlined /></Button></div>
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card
          hoverable
          onClick={() => navigate(ROUTES.GAME1_PLAYERS)}
          styles={{ body: { cursor: 'pointer' } }}
        >
          <Statistic title="Game1" value="挂机放置游戏" prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 14 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>玩家 · 配置 · 成就 · PVP</Text>
          <div style={{ marginTop: 8 }}><Button type="link" size="small">进入管理 <ArrowRightOutlined /></Button></div>
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card
          hoverable
          onClick={() => navigate(ROUTES.TAVERN)}
          styles={{ body: { cursor: 'pointer' } }}
        >
          <Statistic title="AI 酒馆" value="AI 角色聊天" prefix={<CommentOutlined />} valueStyle={{ fontSize: 14 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>角色审核 · 市场 · 密钥</Text>
          <div style={{ marginTop: 8 }}><Button type="link" size="small">进入管理 <ArrowRightOutlined /></Button></div>
        </Card>
      </Col>
    </Row>
  )
}

// ─── FTG 仪表盘 ──────────────────────────────────────

const FtgDashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  const { data: recognitionTrend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['dashboard', 'recognition-trend'],
    queryFn: () => dashboardApi.getRecognitionTrend().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  const { data: userTrend = [], isLoading: userTrendLoading } = useQuery({
    queryKey: ['dashboard', 'user-trend'],
    queryFn: () => dashboardApi.getUserTrend().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  const { data: foodTypeDist = [], isLoading: foodTypeLoading } = useQuery({
    queryKey: ['dashboard', 'food-type-distribution'],
    queryFn: () => dashboardApi.getFoodTypeDistribution().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  const { data: themeUsageDist = [], isLoading: themeUsageLoading } = useQuery({
    queryKey: ['dashboard', 'theme-usage-distribution'],
    queryFn: () => dashboardApi.getThemeUsageDistribution().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  const statCards: StatCardItem[] = [
    { title: '总用户数', value: stats?.totalUsers, icon: <UserOutlined /> },
    { title: '今日新增', value: stats?.newUsersToday, icon: <RiseOutlined />, valueStyle: { color: '#52c41a' } },
    { title: '本月新增', value: stats?.newUsersThisMonth, icon: <RiseOutlined /> },
    { title: '总食物记录', value: stats?.totalFoodRecords, icon: <FileTextOutlined /> },
    { title: '今日识别次数', value: stats?.recognitionsToday, icon: <EyeOutlined />, valueStyle: { color: '#52c41a' } },
    { title: '总打卡数', value: stats?.totalCheckIns, icon: <CheckCircleOutlined /> },
    { title: '今日打卡', value: stats?.checkInsToday, icon: <CheckCircleOutlined />, valueStyle: { color: '#52c41a' } },
  ]

  return (
    <>
      {statsLoading ? (
        <PageSkeleton type="dashboard" />
      ) : (
        <>
          <Row gutter={[16, 16]} className={styles.rowMargin}>
            {statCards.map((item) => (
              <Col key={item.title} xs={12} sm={8} lg={6}>
                <Card><Statistic title={item.title} value={item.value ?? 0} prefix={item.icon} valueStyle={item.valueStyle} /></Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} className={styles.rowMargin}>
            <Col xs={24} lg={12}>
              <Card title="近30天识别量趋势">
                <Spin spinning={trendLoading}>
                  {!Array.isArray(recognitionTrend) || recognitionTrend.length === 0 ? <ChartEmptyState /> : (
                    <Line data={recognitionTrend as TrendItem[]} xField="date" yField="value" shape="smooth" height={CHART_HEIGHT} autoFit point={{ size: 3, shape: 'circle' }} />
                  )}
                </Spin>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="近30天新用户趋势">
                <Spin spinning={userTrendLoading}>
                  {!Array.isArray(userTrend) || userTrend.length === 0 ? <ChartEmptyState /> : (
                    <Column data={userTrend as TrendItem[]} xField="date" yField="value" height={CHART_HEIGHT} autoFit style={{ radius: [4, 4, 0, 0] }} />
                  )}
                </Spin>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="食物类型分布">
                <Spin spinning={foodTypeLoading}>
                  {!Array.isArray(foodTypeDist) || foodTypeDist.length === 0 ? <ChartEmptyState /> : (
                    <Pie data={foodTypeDist as DistributionItem[]} angleField="value" colorField="type" height={CHART_HEIGHT} autoFit label={{ text: 'type', style: { fontWeight: 'bold' } }} legend={{ color: { position: 'bottom' } }} />
                  )}
                </Spin>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="主题使用分布">
                <Spin spinning={themeUsageLoading}>
                  {!Array.isArray(themeUsageDist) || themeUsageDist.length === 0 ? <ChartEmptyState /> : (
                    <Pie data={themeUsageDist as DistributionItem[]} angleField="value" colorField="type" height={CHART_HEIGHT} autoFit label={{ text: 'type', style: { fontWeight: 'bold' } }} legend={{ color: { position: 'bottom' } }} />
                  )}
                </Spin>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </>
  )
}

// ─── Game1 仪表盘 ─────────────────────────────────────

const Game1Dashboard = () => {
  const { data: apiRes, isLoading } = useQuery({
    queryKey: ['game1-dashboard'],
    queryFn: () => game1AdminApi.getDashboard(),
    refetchInterval: REFETCH_INTERVAL,
  })
  const stats = apiRes?.data

  const statCards: StatCardItem[] = [
    { title: '总玩家', value: stats?.totalPlayers, icon: <TeamOutlined /> },
    { title: '今日新增', value: stats?.todayNewPlayers, icon: <RiseOutlined />, valueStyle: { color: '#52c41a' } },
    { title: '本周新增', value: stats?.weekNewPlayers, icon: <RiseOutlined /> },
    { title: 'PVP 场次', value: stats?.totalPvpMatches, icon: <ThunderboltOutlined /> },
    { title: '云存档数', value: stats?.totalCloudSaves, icon: <FileTextOutlined /> },
    { title: '活跃玩家', value: stats?.activeStats?.activePlayers, icon: <UserOutlined /> },
  ]

  return (
    <>
      {isLoading ? (
        <PageSkeleton type="dashboard" />
      ) : (
        <Row gutter={[16, 16]}>
          {statCards.map((item) => (
            <Col key={item.title} xs={12} sm={8} lg={6}>
              <Card><Statistic title={item.title} value={item.value ?? 0} prefix={item.icon} valueStyle={item.valueStyle} /></Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  )
}

// ─── Tavern 仪表盘 ─────────────────────────────────────

const TavernDashboard = () => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Card>
          <Space direction="vertical" style={{ width: '100%', textAlign: 'center', padding: '40px 0' }}>
            <CommentOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            <Title level={4}>AI 酒馆管理</Title>
            <Text type="secondary">角色卡审核 · 市场管理 · API 密钥管理</Text>
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => window.location.href = '/tavern'}>
              进入 AI 酒馆
            </Button>
          </Space>
        </Card>
      </Col>
    </Row>
  )
}

// ─── 主 Dashboard 组件 ────────────────────────────────

const Dashboard = () => {
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectType = getProjectType(currentProject?.name)

  // 动态标题
  const getTitle = () => {
    if (projectType === 'ftg') return `FTG 仪表盘 — ${currentProject?.name || ''}`
    if (projectType === 'game1') return `Game1 仪表盘 — ${currentProject?.name || ''}`
    if (projectType === 'tavern') return `AI 酒馆仪表盘 — ${currentProject?.name || ''}`
    return '仪表盘 — 项目概览'
  }

  return (
    <div className={styles.container}>
      <Space style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} className={styles.title} style={{ margin: 0 }}>
          {getTitle()}
        </Title>
        {projectType !== 'none' && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            数据每 30 秒自动刷新
          </Text>
        )}
      </Space>

      {/* 项目标识头 */}
      {projectType !== 'none' && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card size="small" styles={{ body: { padding: '8px 16px' } }}>
              <Space>
                <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#1677ff' }}>
                  {projectType === 'ftg' ? 'FTG' : projectType === 'game1' ? 'GAME1' : 'TAVERN'}
                </Text>
                <Text>{currentProject?.description || currentProject?.name}</Text>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {projectType === 'none' && <ProjectOverview />}
      {projectType === 'ftg' && <FtgDashboard />}
      {projectType === 'game1' && <Game1Dashboard />}
      {projectType === 'tavern' && <TavernDashboard />}
    </div>
  )
}

export default Dashboard
