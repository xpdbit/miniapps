import { useState } from 'react'
import { Table, Button, Input, Space, Popconfirm, message, Card, Row, Col, Statistic } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TeamOutlined, ReloadOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { game1AdminApi } from '@/services/game1'
import dayjs from 'dayjs'

const Game1Players = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data: playersData, isLoading } = useQuery({
    queryKey: ['game1-players', page, search],
    queryFn: () => game1AdminApi.getPlayers({ page, pageSize: 20, search: search || undefined }),
  })

  const { data: dashboardRes } = useQuery({
    queryKey: ['game1-dashboard'],
    queryFn: () => game1AdminApi.getDashboard(),
  })
  const stats = dashboardRes?.data

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleDelete = async (playerId: number) => {
    try {
      await game1AdminApi.softDeletePlayer(playerId)
      message.success('已软删除该玩家')
      queryClient.invalidateQueries({ queryKey: ['game1-players'] })
    } catch {
      message.error('删除失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', render: (val: string | null) => val || '(未设置)' },
    { title: '等级', dataIndex: 'level', key: 'level', width: 80, sorter: true },
    { title: '里程', dataIndex: 'totalMileage', key: 'totalMileage', width: 100, sorter: true, render: (val: number) => val?.toLocaleString() || '0' },
    { title: '转生', dataIndex: 'prestigeCount', key: 'prestigeCount', width: 80 },
    { title: '经验', dataIndex: 'exp', key: 'exp', width: 100 },
    { title: '登录天数', dataIndex: 'loginDays', key: 'loginDays', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: unknown, record: { id: number }) => (
        <Popconfirm title="确认软删除该玩家？" description="可在数据库恢复。" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Game1 玩家管理"
        extra={<Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['game1'] })}>刷新</Button>}
      />
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}><Card><Statistic title="总玩家" value={stats?.totalPlayers ?? 0} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="今日新增" value={stats?.todayNewPlayers ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="本周新增" value={stats?.weekNewPlayers ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="PVP场次" value={stats?.totalPvpMatches ?? 0} /></Card></Col>
      </Row>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索玩家昵称..." prefix={<SearchOutlined />} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onPressEnter={handleSearch} style={{ width: 280 }} allowClear />
        <Button type="primary" onClick={handleSearch}>搜索</Button>
      </Space>
      {isLoading ? (<PageSkeleton type="table" />) : (
        <Table columns={columns} dataSource={playersData?.data?.items ?? []} rowKey="id" scroll={{ x: 900 }}
          pagination={{ current: page, pageSize: 20, total: playersData?.data?.total ?? 0, onChange: setPage, showTotal: (total) => `共 ${total} 位玩家` }} />
      )}
    </div>
  )
}

export default Game1Players
