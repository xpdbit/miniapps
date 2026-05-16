/**
 * Game1Dashboard — 运营概览
 * 展示 Game1 游戏的核心运营数据面板
 */
import { Card, Row, Col, Statistic, Alert, Button } from 'antd'
import {
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  CloudOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { game1AdminApi } from '@/services/game1'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'

const Game1Dashboard = () => {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['game1-dashboard'],
    queryFn: async () => {
      const res = await game1AdminApi.getDashboard()
      return res.data
    },
  })

  if (isLoading) return <PageSkeleton type="cards" />

  return (
    <div>
      <PageHeader
        title="运营概览"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['game1-dashboard'] })}
      />

      {isError && (
        <Alert
          type="error"
          showIcon
          message="数据加载失败"
          action={<Button size="small" icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['game1-dashboard'] })}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {data && (
        <>
          {/* 核心指标 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card hoverable>
                <Statistic title="总玩家数" value={data.totalPlayers} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card hoverable>
                <Statistic title="今日新增" value={data.todayNewPlayers} prefix={<UserOutlined />} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card hoverable>
                <Statistic title="本周新增" value={data.weekNewPlayers} prefix={<UserOutlined />} valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card hoverable>
                <Statistic title="PVP 总场次" value={data.totalPvpMatches} prefix={<ThunderboltOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable>
                <Statistic title="今日 PVP" value={data.todayPvpMatches} prefix={<TrophyOutlined />} valueStyle={{ color: '#faad14' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card hoverable>
                <Statistic title="云存档数" value={data.totalCloudSaves} prefix={<CloudOutlined />} valueStyle={{ color: '#722ed1' }} />
              </Card>
            </Col>
          </Row>

          {/* 活跃统计 */}
          <Card title="活跃玩家统计" size="small">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={6}>
                <Statistic title="统计周期" value={`${data.activeStats.periodDays} 天`} />
              </Col>
              <Col xs={24} sm={6}>
                <Statistic title="活跃玩家" value={data.activeStats.activePlayers} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col xs={24} sm={6}>
                <Statistic title="活跃期新增" value={data.activeStats.newPlayers} valueStyle={{ color: '#1677ff' }} />
              </Col>
              <Col xs={24} sm={6}>
                <Statistic title="活跃期总玩家" value={data.activeStats.totalPlayers} />
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  )
}

export default Game1Dashboard
