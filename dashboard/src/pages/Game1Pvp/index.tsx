import { Table, Tag, Card, Row, Col, Statistic, Button, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ThunderboltOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { game1AdminApi } from '@/services/game1'

const { Text } = Typography

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#e5e4e2',
  Diamond: '#b9f2ff',
}

const Game1Pvp = () => {
  const queryClient = useQueryClient()

  const { data: dashboardRes } = useQuery({
    queryKey: ['game1-dashboard'],
    queryFn: () => game1AdminApi.getDashboard(),
  })
  const stats = dashboardRes?.data

  const { data: leaderboardRes, isLoading } = useQuery({
    queryKey: ['game1-pvp-leaderboard'],
    queryFn: () => game1AdminApi.getPvpLeaderboard(),
  })
  const rankings = leaderboardRes?.data?.items ?? []

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => {
        if (rank === 1) return <Tag color="gold">1</Tag>
        if (rank === 2) return <Tag color="silver">2</Tag>
        if (rank === 3) return <Tag color="#cd7f32">3</Tag>
        return rank
      },
    },
    { title: '玩家', dataIndex: 'playerName', key: 'playerName' },
    {
      title: '段位',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier: string) => (
        <Tag color={TIER_COLORS[tier] || 'default'} style={{ color: '#fff' }}>
          {tier}
        </Tag>
      ),
    },
    { title: 'Rating', dataIndex: 'rating', key: 'rating', sorter: (a: { rating: number }, b: { rating: number }) => a.rating - b.rating },
    { title: '胜率', dataIndex: 'winRate', key: 'winRate' },
  ]

  return (
    <div>
      <PageHeader
        title="Game1 PVP 排行"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['game1-pvp-leaderboard'] })}>
            刷新
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card>
            <Statistic title="PVP场次" value={stats?.totalPvpMatches ?? 0} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="今日PVP" value={stats?.todayPvpMatches ?? 0} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="活跃玩家" value={stats?.activeStats?.activePlayers ?? 0} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
      </Row>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        排行榜数据每 5 分钟更新一次
      </Text>

      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table
          columns={columns}
          dataSource={rankings}
          rowKey="rank"
          scroll={{ x: 600 }}
          pagination={false}
        />
      )}
    </div>
  )
}

export default Game1Pvp
