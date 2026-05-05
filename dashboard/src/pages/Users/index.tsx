import { useState, useCallback } from 'react'
import { Typography, Table, Input, DatePicker, Button, Tag, Avatar, Drawer, Card, Progress, Space, message, Modal, List, Statistic, Spin } from 'antd'
import useMobile from '@/hooks/useMobile'
import { SearchOutlined, ReloadOutlined, EyeOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI } from '@/services/ftg-api'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// --- Types ---

interface User {
  id: number
  nickname: string
  openid: string
  avatar: string
  foodRecordCount: number
  checkInCount: number
  registeredAt: string
  status: 'active' | 'disabled'
}

interface FoodTypeDist {
  type: string
  count: number
}

interface AchievementProgress {
  id: string
  name: string
  progress: number
}

interface RecentFoodRecord {
  id: number
  foodName: string
  foodType: string
  createdAt: string
}

interface UserStats {
  totalFoodRecords: number
  totalCheckIns: number
  foodTypeDistribution: FoodTypeDist[]
  achievementProgress: AchievementProgress[]
  recentFoodRecords: RecentFoodRecord[]
}

interface UserListResponse {
  list: User[]
  total: number
}

// --- Helpers ---

/**
 * Mask the middle portion of an OpenID.
 * Example: "oxabcdefg" → "ox***efg"
 * Always shows first 2 and last 3 characters with *** in between.
 */
const maskOpenId = (openid: string): string => {
  if (!openid || openid.length <= 5) return openid || '-'
  return `${openid.slice(0, 2)}***${openid.slice(-3)}`
}

// --- Component ---

const Users = () => {
  // Search state
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const queryClient = useQueryClient()
  const isMobile = useMobile()

  // Build query params from current state
  const queryParams = {
    page: pagination.current,
    pageSize: pagination.pageSize,
    ...(keyword ? { keyword } : {}),
    ...(dateRange?.[0] ? { startDate: dateRange[0].format('YYYY-MM-DD') } : {}),
    ...(dateRange?.[1] ? { endDate: dateRange[1].format('YYYY-MM-DD') } : {}),
  }

  // --- React Query: fetch user list ---
  const { data, isLoading } = useQuery<UserListResponse>({
    queryKey: ['users', queryParams],
    queryFn: async () => {
      const res = await usersAPI.list(queryParams)
      return res.data as UserListResponse
    },
    staleTime: 30_000,
  })

  // --- React Query: fetch user stats for drawer ---
  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['userStats', selectedUser?.id],
    queryFn: async () => {
      const res = await usersAPI.getStats(selectedUser!.id)
      return res.data as UserStats
    },
    enabled: !!selectedUser && drawerOpen,
    staleTime: 60_000,
  })

  // --- Mutation: toggle user enable/disable ---
  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await usersAPI.update(id, { status })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('操作成功')
    },
    onError: () => {
      message.error('操作失败，请重试')
    },
  })

  // --- Handlers ---

  const handleSearch = useCallback((value: string) => {
    setKeyword(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }, [])

  const handleDateChange = useCallback((dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates)
    setPagination(prev => ({ ...prev, current: 1 }))
  }, [])

  const handleReset = useCallback(() => {
    setKeyword('')
    setDateRange(null)
    setPagination({ current: 1, pageSize: 20 })
  }, [])

  const handleTableChange = useCallback((pag: TablePaginationConfig) => {
    setPagination({
      current: pag.current ?? 1,
      pageSize: pag.pageSize ?? 20,
    })
  }, [])

  const handleViewDetail = useCallback((user: User) => {
    setSelectedUser(user)
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
    setSelectedUser(null)
  }, [])

  const handleToggleStatus = useCallback((user: User) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    const actionText = newStatus === 'disabled' ? '禁用' : '启用'

    Modal.confirm({
      title: `确认${actionText}用户`,
      content: `确定要${actionText}用户「${user.nickname}」吗？`,
      okText: actionText,
      cancelText: '取消',
      okButtonProps: { danger: newStatus === 'disabled' },
      onOk: () => toggleMutation.mutate({ id: user.id, status: newStatus }),
    })
  }, [toggleMutation])

  // --- Table columns ---
  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', ellipsis: true },
    {
      title: 'OpenID',
      dataIndex: 'openid',
      key: 'openid',
      width: 170,
      render: (val: string) => (
        <Text code copyable={{ text: val }}>{maskOpenId(val)}</Text>
      ),
    },
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 70,
      render: (val: string) => <Avatar src={val} size={36} />,
    },
    { title: '食物记录', dataIndex: 'foodRecordCount', key: 'foodRecordCount', width: 90 },
    { title: '打卡数', dataIndex: 'checkInCount', key: 'checkInCount', width: 80 },
    {
      title: '注册时间',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      width: 170,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'red'}>
          {val === 'active' ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: User) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            danger={record.status === 'active'}
            icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ]

  // Total count for food type distribution percentages
  const totalFoodTypeCount = userStats?.foodTypeDistribution.reduce(
    (sum, item) => sum + item.count, 0,
  ) ?? 0

  return (
    <div>
      <Title level={2}>用户管理</Title>

      {/* Search Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索昵称/OpenID"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
            allowClear
            style={{ width: 280 }}
            enterButton={<SearchOutlined />}
          />
          <RangePicker value={dateRange} onChange={handleDateChange} />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* Data Table */}
      <Table<User>
        columns={columns}
        dataSource={data?.list ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total: number) => `共 ${total} 条`,
        }}
        onChange={(pag) => handleTableChange(pag)}
        scroll={{ x: 960 }}
      />

      {/* Detail Drawer */}
      <Drawer
        title={selectedUser ? `用户详情 - ${selectedUser.nickname}` : '用户详情'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        width={isMobile ? '100%' : 560}
      >
        {statsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : selectedUser && userStats ? (
          <>
            {/* User Basic Info */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space align="center" size={16}>
                <Avatar src={selectedUser.avatar} size={64} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>{selectedUser.nickname}</Title>
                  <Text type="secondary" code copyable={{ text: selectedUser.openid }}>
                    {maskOpenId(selectedUser.openid)}
                  </Text>
                  <br />
                  <Tag
                    color={selectedUser.status === 'active' ? 'green' : 'red'}
                    style={{ marginTop: 4 }}
                  >
                    {selectedUser.status === 'active' ? '正常' : '已禁用'}
                  </Tag>
                </div>
              </Space>
            </Card>

            {/* Stats Cards */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <Card size="small" style={{ flex: 1 }}>
                <Statistic title="食物记录总数" value={userStats.totalFoodRecords} />
              </Card>
              <Card size="small" style={{ flex: 1 }}>
                <Statistic title="打卡总数" value={userStats.totalCheckIns} />
              </Card>
            </div>

            {/* Food Type Distribution */}
            <Card title="食物类型分布" size="small" style={{ marginBottom: 16 }}>
              {userStats.foodTypeDistribution.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {userStats.foodTypeDistribution.map((item) => (
                    <div key={item.type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>{item.type}</Text>
                        <Text type="secondary">{item.count} 次</Text>
                      </div>
                      <Progress
                        percent={totalFoodTypeCount > 0
                          ? Math.round((item.count / totalFoodTypeCount) * 100)
                          : 0}
                        size="small"
                        showInfo={false}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无数据</Text>
              )}
            </Card>

            {/* Achievement Progress */}
            <Card title="成就进度" size="small" style={{ marginBottom: 16 }}>
              {userStats.achievementProgress.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {userStats.achievementProgress.map((achv) => (
                    <div key={achv.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>{achv.name}</Text>
                        <Text type="secondary">{achv.progress}%</Text>
                      </div>
                      <Progress percent={achv.progress} size="small" />
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无数据</Text>
              )}
            </Card>

            {/* Recent Food Records */}
            <Card title="最近食物记录" size="small">
              {userStats.recentFoodRecords.length > 0 ? (
                <List
                  size="small"
                  dataSource={userStats.recentFoodRecords}
                  renderItem={(item: RecentFoodRecord) => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.foodName}
                        description={
                          <Space>
                            <Tag>{item.foodType}</Tag>
                            <Text type="secondary">{dayjs(item.createdAt).format('MM-DD HH:mm')}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Text type="secondary">暂无数据</Text>
              )}
            </Card>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}

export default Users
