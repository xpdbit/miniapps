import { useMemo, useState } from 'react'
import { Typography, Table, Input, DatePicker, Button, Tag, Avatar, Drawer, Card,
  Progress, Space, message, Modal, List, Statistic, Spin, Empty, Tabs,
} from 'antd'
import useMobile from '@/hooks/useMobile'
import { SearchOutlined, ReloadOutlined, EyeOutlined, StopOutlined, CheckCircleOutlined, TeamOutlined, RiseOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI } from '@/services/ftg-api'
import { game1AdminApi } from '@/services/game1'
import { useProjectStore } from '@/stores/projectStore'
import { PageSkeleton } from '@/components/PageSkeleton'
import PageHeader from '@/components/PageHeader'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import type { TabsProps } from 'antd'

const { Text } = Typography
const { RangePicker } = DatePicker

// ═══════════════════════════════════════════════════════════
// 全局统计
// ═══════════════════════════════════════════════════════════

const GlobalStats = () => {
  const { data: ftgStats } = useQuery({
    queryKey: ['ftg-user-summary'],
    queryFn: async () => {
      const res = await usersAPI.list({ page: 1, pageSize: 1 })
      return (res.data as { total: number }).total
    },
    staleTime: 60_000,
  })

  const { data: game1Stats } = useQuery({
    queryKey: ['game1-player-summary'],
    queryFn: async () => {
      const res = await game1AdminApi.getDashboard()
      return res.data?.totalPlayers ?? 0
    },
    staleTime: 60_000,
  })

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
      <Card size="small" style={{ flex: 1 }}>
        <Statistic title="FTG 用户" value={ftgStats ?? 0} prefix={<TeamOutlined />} />
      </Card>
      <Card size="small" style={{ flex: 1 }}>
        <Statistic title="Game1 玩家" value={game1Stats ?? 0} prefix={<RiseOutlined />} />
      </Card>
      <Card size="small" style={{ flex: 1 }}>
        <Statistic title="总计" value={(ftgStats ?? 0) + (game1Stats ?? 0)} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} />
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// FTG 用户管理
// ═══════════════════════════════════════════════════════════

interface FtgUser {
  id: number; nickname: string; openid: string; avatar: string
  foodRecordCount: number; checkInCount: number
  registeredAt: string; status: 'active' | 'disabled'
}

interface FtgStats {
  totalFoodRecords: number; totalCheckIns: number
  foodTypeDistribution: Array<{ type: string; count: number }>
  achievementProgress: Array<{ id: string; name: string; progress: number }>
  recentFoodRecords: Array<{ id: number; foodName: string; foodType: string; createdAt: string }>
}

const FtgUsersView = () => {
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<FtgUser | null>(null)
  const queryClient = useQueryClient()
  const isMobile = useMobile()

  const queryParams = {
    page: pagination.current, pageSize: pagination.pageSize,
    ...(keyword ? { keyword } : {}),
    ...(dateRange?.[0] ? { startDate: dateRange[0].format('YYYY-MM-DD') } : {}),
    ...(dateRange?.[1] ? { endDate: dateRange[1].format('YYYY-MM-DD') } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['ftg-users', queryParams],
    queryFn: async () => {
      const res = await usersAPI.list(queryParams)
      return res.data as { list: FtgUser[]; total: number }
    },
    staleTime: 30_000,
  })

  const { data: userStats, isLoading: statsLoading } = useQuery<FtgStats>({
    queryKey: ['ftg-userStats', selectedUser?.id],
    queryFn: async () => {
      const res = await usersAPI.getStats(selectedUser!.id)
      return res.data as FtgStats
    },
    enabled: !!selectedUser && drawerOpen,
    staleTime: 60_000,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await usersAPI.update(id, { status })
      return res.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ftg-users'] }); message.success('操作成功') },
    onError: () => { message.error('操作失败') },
  })

  const columns: ColumnsType<FtgUser> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', ellipsis: true },
    { title: 'OpenID', dataIndex: 'openid', key: 'openid', width: 170,
      render: (val: string) => <Text code copyable={{ text: val }}>{val ? `${val.slice(0, 2)}***${val.slice(-3)}` : '-'}</Text> },
    { title: '头像', dataIndex: 'avatar', key: 'avatar', width: 70,
      render: (val: string) => <Avatar src={val} size={36} /> },
    { title: '食物记录', dataIndex: 'foodRecordCount', key: 'foodRecordCount', width: 90 },
    { title: '打卡数', dataIndex: 'checkInCount', key: 'checkInCount', width: 80 },
    { title: '注册时间', dataIndex: 'registeredAt', key: 'registeredAt', width: 170,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm') },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (val: string) => <Tag color={val === 'active' ? 'green' : 'red'}>{val === 'active' ? '正常' : '禁用'}</Tag> },
    { title: '操作', key: 'action', width: 160,
      render: (_: unknown, record: FtgUser) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedUser(record); setDrawerOpen(true) }}>详情</Button>
          <Button type="link" size="small" danger={record.status === 'active'}
            icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
            onClick={() => {
              const newStatus = record.status === 'active' ? 'disabled' : 'active'
              Modal.confirm({
                title: `确认${newStatus === 'disabled' ? '禁用' : '启用'}用户`,
                content: `确定要${newStatus === 'disabled' ? '禁用' : '启用'}「${record.nickname}」吗？`,
                onOk: () => toggleMutation.mutate({ id: record.id, status: newStatus }),
                okButtonProps: { danger: newStatus === 'disabled' },
              })
            }}>
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
        </Space>
      )},
  ]

  const totalFoodTypeCount = userStats?.foodTypeDistribution.reduce((s, i) => s + i.count, 0) ?? 0

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search placeholder="搜索昵称/OpenID" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => { setKeyword(v); setPagination(p => ({ ...p, current: 1 })) }}
            allowClear style={{ width: 280 }} enterButton={<SearchOutlined />} />
          <RangePicker value={dateRange} onChange={(dates) => { setDateRange(dates); setPagination(p => ({ ...p, current: 1 })) }} />
          <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setDateRange(null); setPagination({ current: 1, pageSize: 20 }) }}>重置</Button>
        </Space>
      </Card>

      {isLoading ? <PageSkeleton type="table" /> : (
        <Table<FtgUser> columns={columns} dataSource={data?.list ?? []} rowKey="id"
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: data?.total ?? 0,
            showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (t) => `共 ${t} 条` }}
          onChange={(pag) => setPagination({ current: pag.current ?? 1, pageSize: pag.pageSize ?? 20 })}
          scroll={{ x: 960 }} />
      )}

      <Drawer title={selectedUser ? `用户详情 - ${selectedUser.nickname}` : '用户详情'}
        open={drawerOpen} onClose={() => { setDrawerOpen(false); setSelectedUser(null) }}
        width={isMobile ? '100%' : 560}>
        {statsLoading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> :
          selectedUser && userStats ? <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space align="center" size={16}>
                <Avatar src={selectedUser.avatar} size={64} />
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>{selectedUser.nickname}</Typography.Title>
                  <Text type="secondary" code copyable={{ text: selectedUser.openid }}>{selectedUser.openid.slice(0, 2)}***{selectedUser.openid.slice(-3)}</Text>
                  <Tag color={selectedUser.status === 'active' ? 'green' : 'red'} style={{ marginTop: 4 }}>{selectedUser.status === 'active' ? '正常' : '已禁用'}</Tag>
                </div>
              </Space>
            </Card>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <Card size="small" style={{ flex: 1 }}><Statistic title="食物记录总数" value={userStats.totalFoodRecords} /></Card>
              <Card size="small" style={{ flex: 1 }}><Statistic title="打卡总数" value={userStats.totalCheckIns} /></Card>
            </div>
            <Card title="食物类型分布" size="small" style={{ marginBottom: 16 }}>
              {userStats.foodTypeDistribution.map((item) => (
                <div key={item.type} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{item.type}</Text><Text type="secondary">{item.count} 次</Text>
                  </div>
                  <Progress percent={totalFoodTypeCount > 0 ? Math.round((item.count / totalFoodTypeCount) * 100) : 0} size="small" showInfo={false} />
                </div>
              ))}
              {userStats.foodTypeDistribution.length === 0 && <Text type="secondary">暂无数据</Text>}
            </Card>
            <Card title="成就进度" size="small" style={{ marginBottom: 16 }}>
              {userStats.achievementProgress.map((a) => (
                <div key={a.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{a.name}</Text><Text type="secondary">{a.progress}%</Text>
                  </div>
                  <Progress percent={a.progress} size="small" />
                </div>
              ))}
              {userStats.achievementProgress.length === 0 && <Text type="secondary">暂无数据</Text>}
            </Card>
            <Card title="最近食物记录" size="small">
              <List size="small" dataSource={userStats.recentFoodRecords}
                renderItem={(item) => (
                  <List.Item><List.Item.Meta title={item.foodName}
                    description={<Space><Tag>{item.foodType}</Tag><Text type="secondary">{dayjs(item.createdAt).format('MM-DD HH:mm')}</Text></Space>} /></List.Item>
                )} />
              {userStats.recentFoodRecords.length === 0 && <Text type="secondary">暂无数据</Text>}
            </Card>
          </> : null}
      </Drawer>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// Game1 玩家管理
// ═══════════════════════════════════════════════════════════

const Game1PlayersView = () => {
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

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', ellipsis: true, render: (v: string | null) => v || '(未设置)' },
    { title: '等级', dataIndex: 'level', key: 'level', width: 70 },
    { title: '里程', dataIndex: 'totalMileage', key: 'totalMileage', width: 100, render: (v: number) => v?.toLocaleString() || '0' },
    { title: '转生', dataIndex: 'prestigeCount', key: 'prestigeCount', width: 70 },
    { title: '经验', dataIndex: 'exp', key: 'exp', width: 100 },
    { title: '登录天数', dataIndex: 'loginDays', key: 'loginDays', width: 90 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索玩家昵称..." prefix={<SearchOutlined />} value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={() => { setSearch(searchInput); setPage(1) }}
            style={{ width: 280 }} allowClear />
          <Button type="primary" onClick={() => { setSearch(searchInput); setPage(1) }}>搜索</Button>
        </Space>
      </Card>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1 }}><Statistic title="总玩家" value={stats?.totalPlayers ?? 0} /></Card>
        <Card size="small" style={{ flex: 1 }}><Statistic title="今日新增" value={stats?.todayNewPlayers ?? 0} valueStyle={{ color: '#52c41a' }} /></Card>
        <Card size="small" style={{ flex: 1 }}><Statistic title="本周新增" value={stats?.weekNewPlayers ?? 0} /></Card>
        <Card size="small" style={{ flex: 1 }}><Statistic title="PVP场次" value={stats?.totalPvpMatches ?? 0} /></Card>
      </div>
      {isLoading ? <PageSkeleton type="table" /> : (
        <Table columns={columns} dataSource={playersData?.data?.items ?? []} rowKey="id" scroll={{ x: 800 }}
          pagination={{ current: page, pageSize: 20, total: playersData?.data?.total ?? 0, onChange: setPage, showTotal: (t) => `共 ${t} 位玩家` }} />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// Tavern 用户管理（占位说明）
// ═══════════════════════════════════════════════════════════

const TavernUsersView = () => (
  <Card>
    <Empty description={
      <span>AI 酒馆用户管理<Text type="secondary" style={{ display: 'block' }}>Tavern 使用用户认证（非统一管理后台模型），暂不提供集中用户管理</Text></span>
    } />
  </Card>
)

// ═══════════════════════════════════════════════════════════
// 获取当前项目类型
// ═══════════════════════════════════════════════════════════

const getProjectType = (name: string | undefined): 'ftg' | 'game1' | 'tavern' | null => {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('ftg') || n.includes('food')) return 'ftg'
  if (n.includes('game1') || n.includes('game')) return 'game1'
  if (n.includes('tavern') || n.includes('ai')) return 'tavern'
  return null
}

// ═══════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════

const Users = () => {
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectType = getProjectType(currentProject?.name)

  const getTitle = () => {
    if (projectType === 'ftg') return 'FTG 用户管理'
    if (projectType === 'game1') return 'Game1 玩家管理'
    if (projectType === 'tavern') return 'AI 酒馆用户管理'
    return '用户管理'
  }

  // 构建 Tab 项（根据 projectType 过滤）
  const tabItems: TabsProps['items'] = useMemo(() => {
    const allTabs: { key: string; label: string; children: React.ReactNode }[] = [
      { key: 'ftg', label: 'FTG 用户', children: <FtgUsersView /> },
      { key: 'game1', label: 'Game1 玩家', children: <Game1PlayersView /> },
      { key: 'tavern', label: 'AI 酒馆', children: <TavernUsersView /> },
    ]

    if (projectType === 'ftg') return allTabs.filter(t => t.key === 'ftg')
    if (projectType === 'game1') return allTabs.filter(t => t.key === 'game1')
    if (projectType === 'tavern') return allTabs.filter(t => t.key === 'tavern')
    return allTabs // 无项目选中时显示所有
  }, [projectType])

  // 默认选中 tab
  const defaultTab = useMemo(() => {
    if (projectType === 'ftg') return 'ftg'
    if (projectType === 'game1') return 'game1'
    if (projectType === 'tavern') return 'tavern'
    return 'ftg'
  }, [projectType])

  return (
    <div>
      <PageHeader title={getTitle()} />

      {/* 全局统计 */}
      {!projectType && <GlobalStats />}

      {/* Tab 视图 */}
      <Tabs defaultActiveKey={defaultTab} items={tabItems} />
    </div>
  )
}

export default Users
