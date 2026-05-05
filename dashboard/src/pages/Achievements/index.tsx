import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Card,
  Row,
  Col,
  Tag,
  Space,
  Modal,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Progress,
  List,
  Descriptions,
  Popconfirm,
  message,
  Empty,
  Spin,
  Alert,
  Statistic,
  Divider,
} from 'antd'
import useMobile from '@/hooks/useMobile'
import {
  ReloadOutlined,
  EditOutlined,
  UserOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { achievementApi } from '@/services/achievementApi'
import type { Achievement, AchievementUpdateData, UnlockedUser } from '@/services/achievementApi'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography
const { TextArea } = Input

// ─── 条件类型映射 ──────────────────────────────────────────
const CONDITION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  checkin_count: { label: '打卡次数', color: 'blue' },
  consecutive_days: { label: '连续天数', color: 'cyan' },
  food_type_count: { label: '食物类型数', color: 'green' },
  theme_count: { label: '主题数', color: 'purple' },
  morning_checkin: { label: '早起打卡', color: 'orange' },
  night_checkin: { label: '夜间打卡', color: 'geekblue' },
  shared_count: { label: '分享次数', color: 'magenta' },
  unique_food_count: { label: '不同食物数', color: 'lime' },
  daily_checkin_count: { label: '单日打卡次数', color: 'gold' },
  week_full_attendance: { label: '周全勤', color: 'volcano' },
}

const CONDITION_VALUE_LABELS: Record<string, string> = {
  checkin_count: '累计打卡',
  consecutive_days: '连续',
  food_type_count: '尝试',
  theme_count: '收集',
  morning_checkin: '早起打卡',
  night_checkin: '夜间打卡',
  shared_count: '分享',
  unique_food_count: '不同食物',
  daily_checkin_count: '单日打卡',
  week_full_attendance: '要求天数',
}

const getConditionTypeConfig = (type: string) =>
  CONDITION_TYPE_MAP[type] ?? { label: type || '未知', color: 'default' }

const getConditionValueLabel = (type: string) =>
  CONDITION_VALUE_LABELS[type] ?? '目标值'

// ─── 工具函数 ──────────────────────────────────────────────
const maskOpenId = (openId: string): string => {
  if (!openId) return '-'
  if (openId.length <= 6) return openId.slice(0, 3) + '***'
  return openId.slice(0, 3) + '****' + openId.slice(-4)
}

// ─── 组件 ──────────────────────────────────────────────────
const Achievements = () => {
  const queryClient = useQueryClient()

  // ── 编辑弹窗状态 ──
  const [editModalOpen, setEditModalOpen] = useState(false)
  const isMobile = useMobile()
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null)
  const [editForm] = Form.useForm<{
    icon: string
    description: string
    conditionValue: number
    themeId: number | null
  }>()

  // ── 解锁用户抽屉状态 ──
  const [usersDrawerOpen, setUsersDrawerOpen] = useState(false)
  const [viewingAchievement, setViewingAchievement] = useState<Achievement | null>(null)

  // ── 手动触发弹窗状态 ──
  const [triggerModalOpen, setTriggerModalOpen] = useState(false)
  const [triggerForm] = Form.useForm<{ userOpenId: string; achievementId?: string }>()

  // ── 查询成就列表 ──
  const {
    data: achievementsRes,
    isLoading: achievementsLoading,
    isError: achievementsError,
  } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const res = await achievementApi.list()
      return res.data.data.achievements
    },
  })

  // ── 查询统计面板 ──
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['achievements-stats'],
    queryFn: async () => {
      const res = await achievementApi.getStats()
      return res.data.data
    },
  })

  // ── 查询解锁用户 ──
  const {
    data: unlockedUsers,
    isFetching: usersLoading,
  } = useQuery({
    queryKey: ['achievement-users', viewingAchievement?.id],
    queryFn: async () => {
      if (!viewingAchievement) return []
      const res = await achievementApi.getUnlockedUsers(viewingAchievement.id)
      return res.data.data.users
    },
    enabled: usersDrawerOpen && !!viewingAchievement,
  })

  // ── 更新成就 Mutation ──
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AchievementUpdateData }) => {
      await achievementApi.update(id, data)
    },
    onSuccess: () => {
      message.success('成就配置已更新')
      setEditModalOpen(false)
      setEditingAchievement(null)
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      queryClient.invalidateQueries({ queryKey: ['achievements-stats'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 手动触发 Mutation ──
  const triggerMutation = useMutation({
    mutationFn: async (params: { userOpenId: string; achievementId?: string }) => {
      const res = await achievementApi.triggerCheck(params.userOpenId, params.achievementId)
      return res.data.data
    },
    onSuccess: (data) => {
      if (data.unlocked.length > 0) {
        message.success(`成就检测完成！用户解锁了 ${data.unlocked.length} 个成就：${data.unlocked.join('、')}`)
      } else {
        message.info('成就检测完成，用户未解锁新成就')
      }
      setTriggerModalOpen(false)
      triggerForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['achievements'] })
      queryClient.invalidateQueries({ queryKey: ['achievements-stats'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 打开编辑弹窗 ──
  const handleOpenEdit = (achievement: Achievement) => {
    setEditingAchievement(achievement)
    editForm.setFieldsValue({
      icon: achievement.icon,
      description: achievement.description,
      conditionValue: achievement.conditionValue,
      themeId: achievement.themeId,
    })
    setEditModalOpen(true)
  }

  // ── 提交编辑 ──
  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!editingAchievement) return

      const data: AchievementUpdateData = {
        icon: values.icon,
        description: values.description,
        conditionValue: values.conditionValue,
        themeId: values.themeId ?? null,
      }

      updateMutation.mutate({ id: editingAchievement.id, data })
    } catch {
      // 表单校验失败，Ant Design 已自动提示
    }
  }

  // ── 查看解锁用户 ──
  const handleViewUsers = (achievement: Achievement) => {
    setViewingAchievement(achievement)
    setUsersDrawerOpen(true)
  }

  // ── 关闭解锁用户抽屉 ──
  const handleCloseUsersDrawer = () => {
    setUsersDrawerOpen(false)
    setViewingAchievement(null)
  }

  // ── 打开手动触发弹窗 ──
  const handleOpenTrigger = () => {
    triggerForm.resetFields()
    setTriggerModalOpen(true)
  }

  // ── 提交手动触发 ──
  const handleTriggerSubmit = async () => {
    try {
      const values = await triggerForm.validateFields()
      triggerMutation.mutate({
        userOpenId: values.userOpenId,
        achievementId: values.achievementId || undefined,
      })
    } catch {
      // 表单校验失败
    }
  }

  // ── 成就列表表格列 ──
  const columns: ColumnsType<Achievement> = [
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 70,
      align: 'center',
      render: (icon: string) => (
        <span style={{ fontSize: 28, lineHeight: 1 }}>{icon || '🏆'}</span>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      ellipsis: true,
      render: (name: string, record: Achievement) => (
        <Space>
          <Text strong>{name}</Text>
          {record.isPreset && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px' }}>预设</Tag>}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 220,
      ellipsis: true,
    },
    {
      title: '条件类型',
      dataIndex: 'conditionType',
      key: 'conditionType',
      width: 120,
      render: (type: string) => {
        const config = getConditionTypeConfig(type)
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '目标值',
      dataIndex: 'conditionValue',
      key: 'conditionValue',
      width: 120,
      align: 'center',
      render: (value: number, record: Achievement) => (
        <Text strong style={{ fontSize: 15 }}>
          {getConditionValueLabel(record.conditionType)} ≥ {value}
          {record.conditionType === 'consecutive_days' && ' 天'}
          {record.conditionType === 'checkin_count' && ' 次'}
        </Text>
      ),
    },
    {
      title: '关联主题',
      dataIndex: 'themeName',
      key: 'themeName',
      width: 120,
      ellipsis: true,
      render: (name: string | null) =>
        name ? <Tag color="purple">{name}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_: unknown, record: Achievement) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => handleViewUsers(record)}
          >
            查看用户
          </Button>
        </Space>
      ),
    },
  ]

  // ── 统计面板：进度条颜色 ──
  const getProgressColor = (rate: number): string => {
    if (rate >= 80) return '#52c41a'
    if (rate >= 50) return '#1677ff'
    if (rate >= 20) return '#faad14'
    return '#ff4d4f'
  }

  // ── 渲染 ──
  return (
    <div>
      {/* ── 页面头部 ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          成就管理
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['achievements'] })
              queryClient.invalidateQueries({ queryKey: ['achievements-stats'] })
            }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleOpenTrigger}
          >
            手动触发检测
          </Button>
        </Space>
      </div>

      {/* ── 统计面板 ── */}
      {statsError && !statsLoading && (
        <Alert
          type="error"
          showIcon
          message="统计面板加载失败"
          description="无法获取成就统计数据，请稍后重试。"
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['achievements-stats'] })}
            >
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={statsLoading}>
        {stats && (
          <>
            {/* 概览卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <Card hoverable>
                  <Statistic
                    title="总用户数"
                    value={stats.totalUsers}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#1677ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card hoverable>
                  <Statistic
                    title="已解锁用户数"
                    value={stats.unlockedUsersCount}
                    suffix={`/ ${stats.totalUsers}`}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card hoverable>
                  <Statistic
                    title="总体解锁率"
                    value={Math.round(stats.overallUnlockRate * 100) / 100}
                    suffix="%"
                    precision={1}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: getProgressColor(stats.overallUnlockRate) }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 各成就完成率 */}
            <Card
              title="各成就完成率"
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 12]}>
                {stats.achievementRates.map((item) => {
                  const ratePercent = Math.round(item.rate * 100)
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={item.achievementId}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            ellipsis
                            style={{ fontSize: 13, maxWidth: 160 }}
                            title={item.achievementName}
                          >
                            {item.achievementName}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                            {item.unlockedCount}/{item.totalCount}
                          </Text>
                        </div>
                        <Progress
                          percent={ratePercent}
                          size="small"
                          strokeColor={getProgressColor(item.rate * 100)}
                          showInfo={false}
                        />
                      </div>
                    </Col>
                  )
                })}
              </Row>
            </Card>

            {/* 最近解锁活动 */}
            <Card
              title={
                <Space>
                  <span>最近解锁活动</span>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                    （最近 10 条）
                  </Text>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              {stats.recentUnlocks.length === 0 ? (
                <Empty
                  description="暂无解锁记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <List
                  size="small"
                  dataSource={stats.recentUnlocks}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space size={4}>
                            <TrophyOutlined style={{ color: '#faad14' }} />
                            <Text strong>{item.achievementName}</Text>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.userName || maskOpenId(item.userOpenId)} ·{' '}
                            {dayjs(item.unlockedAt).format('YYYY-MM-DD HH:mm')}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </>
        )}

        {/* Stats 无数据（非加载也非错误） */}
        {!stats && !statsLoading && !statsError && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Empty description="暂无统计数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        )}
      </Spin>

      {/* ── 成就定义表格 ── */}
      <Card
        title="成就定义"
        size="small"
        style={{ marginBottom: 16 }}
      >
        {achievementsError && !achievementsLoading && (
          <Alert
            type="error"
            showIcon
            message="成就列表加载失败"
            description="无法获取成就数据，请稍后重试。"
            action={
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['achievements'] })}
              >
                重试
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Table<Achievement>
          rowKey="id"
          columns={columns}
          dataSource={achievementsRes ?? []}
          loading={achievementsLoading}
          scroll={{ x: 1000 }}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                description="暂无成就数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* ── 编辑成就弹窗 ── */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>编辑成就配置</span>
          </Space>
        }
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingAchievement(null)
        }}
        width={isMobile ? '100%' : 560}
        footer={
          <Space>
            <Button onClick={() => {
              setEditModalOpen(false)
              setEditingAchievement(null)
            }}>
              取消
            </Button>
            <Button
              type="primary"
              loading={updateMutation.isPending}
              onClick={handleEditSubmit}
            >
              保存
            </Button>
          </Space>
        }
      >
        {editingAchievement && (
          <Form
            form={editForm}
            layout="vertical"
            initialValues={{
              icon: editingAchievement.icon,
              description: editingAchievement.description,
              conditionValue: editingAchievement.conditionValue,
              themeId: editingAchievement.themeId,
            }}
          >
            {/* 当前成就信息（只读） */}
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="名称">
                <Space>
                  <span style={{ fontSize: 18 }}>{editingAchievement.icon}</span>
                  <Text strong>{editingAchievement.name}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="条件类型">
                <Tag color={getConditionTypeConfig(editingAchievement.conditionType).color}>
                  {getConditionTypeConfig(editingAchievement.conditionType).label}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '0 0 16px' }} />

            <Form.Item
              name="icon"
              label="图标 (Emoji)"
              rules={[
                { required: true, message: '请输入 Emoji 图标' },
              ]}
            >
              <Input
                placeholder="例如：🏆🌟🎯"
                maxLength={4}
                style={{ fontSize: 24 }}
              />
            </Form.Item>

            <Form.Item
              name="description"
              label="描述"
              rules={[
                { required: true, message: '请输入成就描述' },
                { max: 200, message: '描述不超过 200 字符' },
              ]}
            >
              <TextArea rows={2} placeholder="输入成就描述" maxLength={200} showCount />
            </Form.Item>

            <Form.Item
              name="conditionValue"
              label={
                <Text>
                  条件目标值{' '}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    （当前类型：{getConditionTypeConfig(editingAchievement.conditionType).label}）
                  </Text>
                </Text>
              }
              rules={[
                { required: true, message: '请输入条件目标值' },
                { type: 'number', min: 1, message: '目标值必须 ≥ 1' },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={99999}
                placeholder="输入目标值"
              />
            </Form.Item>

            <Form.Item name="themeId" label="关联主题 ID（可选）">
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                placeholder="输入主题 ID，留空表示不关联"
              />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              message="注意"
              description="条件类型为系统设定，不可更改。预设成就不支持删除。"
              style={{ marginTop: 8 }}
            />
          </Form>
        )}
      </Modal>

      {/* ── 查看解锁用户抽屉 ── */}
      <Drawer
        title={
          viewingAchievement ? (
            <Space>
              <span style={{ fontSize: 22 }}>{viewingAchievement.icon}</span>
              <span>{viewingAchievement.name} - 已解锁用户</span>
            </Space>
          ) : (
            '已解锁用户'
          )
        }
        placement="right"
        width={isMobile ? '100%' : 480}
        open={usersDrawerOpen}
        onClose={handleCloseUsersDrawer}
        extra={
          <Button type="text" onClick={handleCloseUsersDrawer}>
            关闭
          </Button>
        }
      >
        {viewingAchievement && (
          <Spin spinning={usersLoading}>
            {/* 成就概要 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="成就">{viewingAchievement.name}</Descriptions.Item>
                <Descriptions.Item label="描述">{viewingAchievement.description}</Descriptions.Item>
                <Descriptions.Item label="条件类型">
                  <Tag color={getConditionTypeConfig(viewingAchievement.conditionType).color}>
                    {getConditionTypeConfig(viewingAchievement.conditionType).label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="目标值">
                  <Text strong>{viewingAchievement.conditionValue}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 用户列表 */}
            {(!unlockedUsers || unlockedUsers.length === 0) && !usersLoading ? (
              <Empty
                description="暂无用户解锁此成就"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                size="small"
                dataSource={unlockedUsers ?? []}
                loading={usersLoading}
                pagination={{
                  pageSize: 10,
                  showTotal: (total) => `共 ${total} 位用户`,
                  size: 'small',
                }}
                renderItem={(item: UnlockedUser, index: number) => {
                  const idx = index
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: '#f0f5ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#1677ff',
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            {idx + 1}
                          </div>
                        }
                        title={
                          <Text style={{ fontSize: 14 }}>
                            {item.userName || '匿名用户'}
                          </Text>
                        }
                        description={
                          <Space>
                            <Text
                              copyable={{ text: item.userOpenId }}
                              style={{ fontFamily: 'monospace', fontSize: 12 }}
                              type="secondary"
                            >
                              {maskOpenId(item.userOpenId)}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              解锁于 {dayjs(item.unlockedAt).format('YYYY-MM-DD HH:mm')}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Spin>
        )}
      </Drawer>

      {/* ── 手动触发成就检测弹窗 ── */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <span>手动触发成就检测</span>
          </Space>
        }
        open={triggerModalOpen}
        onCancel={() => {
          setTriggerModalOpen(false)
          triggerForm.resetFields()
        }}
        width={isMobile ? '100%' : 480}
        footer={
          <Space>
            <Button onClick={() => {
              setTriggerModalOpen(false)
              triggerForm.resetFields()
            }}>
              取消
            </Button>
            <Popconfirm
              title="确认触发检测"
              description="系统将根据当前数据检测该用户是否符合成就条件，确认执行？"
              onConfirm={handleTriggerSubmit}
              okText="确认执行"
              cancelText="取消"
              okButtonProps={{ loading: triggerMutation.isPending }}
            >
              <Button type="primary" icon={<ThunderboltOutlined />}>
                执行检测
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Form
          form={triggerForm}
          layout="vertical"
          initialValues={{ userOpenId: '', achievementId: undefined }}
        >
          <Alert
            type="warning"
            showIcon
            message="操作说明"
            description="手动触发将重新检测指定用户的成就进度。该操作将基于当前数据运行完整检测逻辑。"
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="userOpenId"
            label="用户 OpenID"
            rules={[
              { required: true, message: '请输入用户的 OpenID' },
              { min: 4, message: 'OpenID 长度不足' },
            ]}
          >
            <Input placeholder="输入用户 OpenID" />
          </Form.Item>

          <Form.Item name="achievementId" label="指定成就（可选）">
            <Select
              allowClear
              placeholder="不指定则检测所有成就"
              loading={achievementsLoading}
              options={(achievementsRes ?? []).map((a) => ({
                value: a.id,
                label: `${a.icon} ${a.name}`,
              }))}
            />
          </Form.Item>

          {triggerMutation.isSuccess && (
            <Alert
              type="success"
              showIcon
              message="检测完成"
              description={`已成功执行检测。`}
              style={{ marginTop: 8 }}
            />
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default Achievements
