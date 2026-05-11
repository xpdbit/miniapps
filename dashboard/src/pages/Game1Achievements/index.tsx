import { Table, Tag, Card, Row, Col, Statistic, Button } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrophyOutlined, ReloadOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { game1AdminApi } from '@/services/game1'

const Game1Achievements = () => {
  const queryClient = useQueryClient()

  const { data: dashboardRes } = useQuery({
    queryKey: ['game1-dashboard'],
    queryFn: () => game1AdminApi.getDashboard(),
  })
  const stats = dashboardRes?.data

  const { data: achievementsRes, isLoading } = useQuery({
    queryKey: ['game1-achievements'],
    queryFn: () => game1AdminApi.getAchievements(),
  })
  const achievements = achievementsRes?.data?.items ?? []

  const avgUnlocked = achievements.length > 0
    ? (achievements.reduce((sum, a) => sum + a.unlockedCount, 0) / achievements.length).toFixed(1)
    : '0'

  const columns = [
    { title: '成就名称', dataIndex: 'title', key: 'title' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '解锁条件',
      dataIndex: 'condition',
      key: 'condition',
      render: (condition: string) => <Tag color="blue">{condition}</Tag>,
    },
    {
      title: '解锁人数',
      dataIndex: 'unlockedCount',
      key: 'unlockedCount',
      sorter: (a: { unlockedCount: number }, b: { unlockedCount: number }) => a.unlockedCount - b.unlockedCount,
    },
    {
      title: '解锁率',
      key: 'rate',
      render: (_: unknown, record: { unlockedCount: number; totalPlayers: number }) => {
        const total = record.totalPlayers || 1
        const rate = Math.round((record.unlockedCount / total) * 100)
        return (
          <span style={{ color: rate > 50 ? '#52c41a' : rate > 20 ? '#faad14' : '#ff4d4d' }}>
            {rate}%
          </span>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Game1 成就管理"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['game1-achievements'] })}>
            刷新
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card>
            <Statistic title="成就总数" value={achievements.length} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="总玩家" value={stats?.totalPlayers ?? 0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="平均解锁" value={avgUnlocked} prefix={<CheckCircleOutlined />} suffix="个/人" />
          </Card>
        </Col>
      </Row>

      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table
          columns={columns}
          dataSource={achievements}
          rowKey="achievementId"
          scroll={{ x: 700 }}
          pagination={false}
        />
      )}
    </div>
  )
}

export default Game1Achievements
