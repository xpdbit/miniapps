import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Col,
  Empty,
  Row,
  Spin,
  Statistic,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  RiseOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Column, Line, Pie } from '@ant-design/charts'
import { PageSkeleton } from '@/components/PageSkeleton'
import { dashboardApi } from '@/services/dashboardApi'
import type { DistributionItem, TrendItem } from '@/services/dashboardApi'
import styles from '@/styles/pages/dashboard.module.scss'

const { Title } = Typography

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

const Dashboard = () => {
  // --- 统计数据 ---
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 近30天识别量趋势 ---
  const { data: recognitionTrend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['dashboard', 'recognition-trend'],
    queryFn: () =>
      dashboardApi.getRecognitionTrend().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 近30天新用户趋势 ---
  const { data: userTrend = [], isLoading: userTrendLoading } = useQuery({
    queryKey: ['dashboard', 'user-trend'],
    queryFn: () => dashboardApi.getUserTrend().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 食物类型分布 ---
  const { data: foodTypeDist = [], isLoading: foodTypeLoading } = useQuery({
    queryKey: ['dashboard', 'food-type-distribution'],
    queryFn: () =>
      dashboardApi.getFoodTypeDistribution().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 主题使用分布 ---
  const { data: themeUsageDist = [], isLoading: themeUsageLoading } = useQuery({
    queryKey: ['dashboard', 'theme-usage-distribution'],
    queryFn: () =>
      dashboardApi.getThemeUsageDistribution().then((res) => res.data),
    refetchInterval: REFETCH_INTERVAL,
  })

  // --- 统计卡片渲染 ---
  const statCards: StatCardItem[] = [
    {
      title: '总用户数',
      value: stats?.totalUsers,
      icon: <UserOutlined />,
    },
    {
      title: '今日新增',
      value: stats?.newUsersToday,
      icon: <RiseOutlined />,
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '本月新增',
      value: stats?.newUsersThisMonth,
      icon: <RiseOutlined />,
    },
    {
      title: '总食物记录',
      value: stats?.totalFoodRecords,
      icon: <FileTextOutlined />,
    },
    {
      title: '今日识别次数',
      value: stats?.recognitionsToday,
      icon: <EyeOutlined />,
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '总打卡数',
      value: stats?.totalCheckIns,
      icon: <CheckCircleOutlined />,
    },
    {
      title: '今日打卡',
      value: stats?.checkInsToday,
      icon: <CheckCircleOutlined />,
      valueStyle: { color: '#52c41a' },
    },
  ]

  return (
    <div className={styles.container}>
      <Title level={3} className={styles.title}>
        仪表盘
      </Title>

      {statsLoading ? (
        <PageSkeleton type="dashboard" />
      ) : (
        <>
          {/* ===== 统计卡片行 ===== */}
          <Row gutter={[16, 16]} className={styles.rowMargin}>
            {statCards.map((item) => (
              <Col key={item.title} xs={12} sm={8} lg={6}>
                <Card>
                  <Statistic
                    title={item.title}
                    value={item.value ?? 0}
                    prefix={item.icon}
                    valueStyle={item.valueStyle}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* ===== 图表第一行：折线图 + 柱状图 ===== */}
          <Row gutter={[16, 16]} className={styles.rowMargin}>
            <Col xs={24} lg={12}>
              <Card title="近30天识别量趋势">
                <Spin spinning={trendLoading}>
                  {!Array.isArray(recognitionTrend) || recognitionTrend.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <Line
                      data={recognitionTrend as TrendItem[]}
                      xField="date"
                      yField="value"
                      shape="smooth"
                      height={CHART_HEIGHT}
                      autoFit
                      point={{ size: 3, shape: 'circle' }}
                    />
                  )}
                </Spin>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="近30天新用户趋势">
                <Spin spinning={userTrendLoading}>
                  {!Array.isArray(userTrend) || userTrend.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <Column
                      data={userTrend as TrendItem[]}
                      xField="date"
                      yField="value"
                      height={CHART_HEIGHT}
                      autoFit
                      style={{ radius: [4, 4, 0, 0] }}
                    />
                  )}
                </Spin>
              </Card>
            </Col>
          </Row>

          {/* ===== 图表第二行：饼图 + 饼图 ===== */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="食物类型分布">
                <Spin spinning={foodTypeLoading}>
                  {!Array.isArray(foodTypeDist) || foodTypeDist.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <Pie
                      data={foodTypeDist as DistributionItem[]}
                      angleField="value"
                      colorField="type"
                      height={CHART_HEIGHT}
                      autoFit
                      label={{ text: 'type', style: { fontWeight: 'bold' } }}
                      legend={{ color: { position: 'bottom' } }}
                    />
                  )}
                </Spin>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="主题使用分布">
                <Spin spinning={themeUsageLoading}>
                  {!Array.isArray(themeUsageDist) || themeUsageDist.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <Pie
                      data={themeUsageDist as DistributionItem[]}
                      angleField="value"
                      colorField="type"
                      height={CHART_HEIGHT}
                      autoFit
                      label={{ text: 'type', style: { fontWeight: 'bold' } }}
                      legend={{ color: { position: 'bottom' } }}
                    />
                  )}
                </Spin>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}

export default Dashboard
