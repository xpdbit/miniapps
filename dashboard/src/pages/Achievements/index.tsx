/**
 * Achievements 页面 — 成就管理
 *
 * 拆分为子组件：
 * - AchievementStatsPanel: 统计面板
 * - AchievementEditModal: 编辑配置弹窗
 * - UnlockedUsersDrawer: 已解锁用户抽屉
 * - TriggerDetectionModal: 手动触发检测弹窗
 */
import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Card,
  Space,
  Tag,
  message,
  Empty,
  Alert,
} from 'antd'
import {
  ReloadOutlined,
  EditOutlined,
  UserOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { achievementApi } from '@/services/achievementApi'
import type { Achievement, AchievementUpdateData, UnlockedUser } from '@/services/achievementApi'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { Form } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getConditionTypeConfig, getConditionValueLabel } from './constants'
import AchievementStatsPanel from './AchievementStatsPanel'
import AchievementEditModal from './AchievementEditModal'
import UnlockedUsersDrawer from './UnlockedUsersDrawer'
import TriggerDetectionModal from './TriggerDetectionModal'

const { Text } = Typography

const Achievements = () => {
  const queryClient = useQueryClient()

  // ── 编辑弹窗状态 ──
  const [editModalOpen, setEditModalOpen] = useState(false)
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

  // ── 事件处理 ──
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

  const handleViewUsers = (achievement: Achievement) => {
    setViewingAchievement(achievement)
    setUsersDrawerOpen(true)
  }

  const handleCloseUsersDrawer = () => {
    setUsersDrawerOpen(false)
    setViewingAchievement(null)
  }

  const handleOpenTrigger = () => {
    triggerForm.resetFields()
    setTriggerModalOpen(true)
  }

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

  // ── 表格列定义 ──
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

  // ── 渲染 ──
  return (
    <div>
      <PageHeader
        title="成就管理"
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['achievements'] })
          queryClient.invalidateQueries({ queryKey: ['achievements-stats'] })
        }}
        extra={<Button type="primary" icon={<ThunderboltOutlined />} onClick={handleOpenTrigger}>手动触发检测</Button>}
      />

      {/* 统计面板 */}
      <AchievementStatsPanel stats={stats} statsLoading={statsLoading} statsError={statsError} />

      {/* 成就定义表格 */}
      <Card title="成就定义" size="small" style={{ marginBottom: 16 }}>
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

        {achievementsLoading ? (
          <PageSkeleton type="table" rows={3} />
        ) : (
          <Table<Achievement>
            rowKey="id"
            columns={columns}
            dataSource={achievementsRes ?? []}
            scroll={{ x: 1000 }}
            pagination={false}
            locale={{
              emptyText: (
                <Empty description="暂无成就数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            }}
          />
        )}
      </Card>

      {/* 编辑成就弹窗 */}
      <AchievementEditModal
        open={editModalOpen}
        editingAchievement={editingAchievement}
        form={editForm}
        loading={updateMutation.isPending}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingAchievement(null)
        }}
        onSubmit={handleEditSubmit}
      />

      {/* 已解锁用户抽屉 */}
      <UnlockedUsersDrawer
        open={usersDrawerOpen}
        viewingAchievement={viewingAchievement}
        unlockedUsers={unlockedUsers as UnlockedUser[] | undefined}
        usersLoading={usersLoading}
        onClose={handleCloseUsersDrawer}
      />

      {/* 手动触发检测弹窗 */}
      <TriggerDetectionModal
        open={triggerModalOpen}
        form={triggerForm}
        loading={triggerMutation.isPending}
        achievements={achievementsRes}
        isSuccess={triggerMutation.isSuccess}
        onCancel={() => {
          setTriggerModalOpen(false)
          triggerForm.resetFields()
        }}
        onSubmit={handleTriggerSubmit}
      />
    </div>
  )
}

export default Achievements
