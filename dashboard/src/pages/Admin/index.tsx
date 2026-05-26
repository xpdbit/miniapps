import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Card,
  message,
  Popconfirm,
  Row,
  Col,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { adminApi } from '@/services/adminApi'
import PageHeader from '@/components/PageHeader'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import type { AdminRole } from '@/types'

const { Text } = Typography

// ─── 角色中文标签 ──────────────────────────────────────────

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  viewer: '观察者',
}

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: 'red',
  admin: 'blue',
  viewer: 'green',
}

const STATUS_LABELS: Record<string, string> = {
  active: '正常',
  disabled: '已禁用',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  disabled: 'red',
}

// ─── 权限中文映射 ──────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: '仪表盘',
  users: '用户管理',
  records: '食物记录',
  themes: '主题管理',
  achievements: '成就管理',
  api_keys: 'API密钥',
  projects: '项目管理',
  monitoring: '系统监控',
  admin_users: '管理员管理',
  audit_logs: '审计日志',
}

// ─── 角色选项 ─────────────────────────────────────────────

const ROLE_OPTIONS: Array<{ label: string; value: AdminRole }> = [
  { label: '超级管理员', value: 'super_admin' },
  { label: '管理员', value: 'admin' },
  { label: '观察者', value: 'viewer' },
]

// ─── 类型定义 ─────────────────────────────────────────────

interface AdminUserItem {
  id: number
  username: string
  role: AdminRole
  status: string
  createdAt: string
  updatedAt: string
}

interface RoleInfo {
  name: AdminRole
  label: string
  permissions: string[]
}

interface CreateAdminForm {
  username: string
  password: string
  role: AdminRole
}

// ─── 组件 ────────────────────────────────────────────────────

const Admin = () => {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)

  // 创建弹窗
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm<CreateAdminForm>()
  const [creating, setCreating] = useState(false)

  // 修改角色弹窗
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)
  const [newRole, setNewRole] = useState<AdminRole>('viewer')

  // ── 查询管理员列表 ──

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await adminApi.list()
      return res.data.data.users as AdminUserItem[]
    },
  })

  // ── 查询角色列表 ──

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await adminApi.getRoles()
      return res.data.data.roles as RoleInfo[]
    },
  })

  // ── 创建管理员 Mutation ──

  const createMutation = useMutation({
    mutationFn: async (values: CreateAdminForm) => {
      await adminApi.create(values)
    },
    onSuccess: () => {
      message.success('管理员创建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 修改角色 Mutation ──

  const roleMutation = useMutation({
    mutationFn: async (params: { id: number; role: AdminRole }) => {
      await adminApi.changeRole(params.id, params.role)
    },
    onSuccess: () => {
      message.success('角色修改成功')
      setRoleModalOpen(false)
      setSelectedUser(null)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 删除管理员 Mutation ──

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await adminApi.delete(id)
    },
    onSuccess: () => {
      message.success('管理员已删除')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 创建弹窗 ──

  const handleOpenCreate = () => {
    createForm.resetFields()
    setCreateModalOpen(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      setCreating(true)
      await createMutation.mutateAsync(values)
    } catch {
      // 表单校验或 API 错误
    } finally {
      setCreating(false)
    }
  }

  const handleCreateCancel = () => {
    setCreateModalOpen(false)
    createForm.resetFields()
  }

  // ── 修改角色弹窗 ──

  const handleOpenRoleChange = (user: AdminUserItem) => {
    setSelectedUser(user)
    setNewRole(user.role)
    setRoleModalOpen(true)
  }

  const handleRoleChangeSubmit = () => {
    if (!selectedUser) return
    roleMutation.mutate({ id: selectedUser.id, role: newRole })
  }

  const handleRoleChangeCancel = () => {
    setRoleModalOpen(false)
    setSelectedUser(null)
  }

  // ── 列表列定义 ──

  const columns: ColumnsType<AdminUserItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: AdminUserItem) => (
        <Space>
          <span>{username}</span>
          {currentUser?.uuid === String(record.id) && (
            <Tag color="blue">当前用户</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role: AdminRole) => {
        const color = ROLE_COLORS[role]
        const label = ROLE_LABELS[role]
        return <Tag color={color}>{label ?? role}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color = STATUS_COLORS[status]
        const label = STATUS_LABELS[status]
        return <Tag color={color ?? 'default'}>{label ?? status}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: AdminUserItem) => {
        const isSelf = currentUser?.uuid === String(record.id)
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<SwapOutlined />}
              disabled={isSelf}
              onClick={() => { handleOpenRoleChange(record) }}
            >
              修改角色
            </Button>
            <Popconfirm
              title="确认删除"
              description={`确定要删除管理员「${record.username}」吗？此操作不可恢复。`}
              onConfirm={() => { deleteMutation.mutate(record.id) }}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            >
              <Button
                type="link"
                size="small"
                danger
                disabled={isSelf}
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  // ── 角色权限卡片 ──

  const renderRoleCard = (role: RoleInfo) => (
    <Card
      key={role.name}
      size="small"
      title={
        <Space>
          <Tag color={ROLE_COLORS[role.name]}>{role.label}</Tag>
          <Text type="secondary" code>{role.name}</Text>
        </Space>
      }
      styles={{ body: { height: '100%' } }}
    >
      <Space wrap size={[4, 4]}>
        {role.permissions.map((perm) => {
          const permLabel = PERMISSION_LABELS[perm]
          return (
            <Tag key={perm} color="default">
              {permLabel ?? perm}
            </Tag>
          )
        })}
      </Space>
    </Card>
  )

  return (
    <div>
      {/* ── 页面头部 ── */}
      <PageHeader
        title="管理员管理"
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-users'] })
          queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
        }}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>新增管理员</Button>}
      />

      {/* ── 角色信息卡片 ── */}
      {roles && roles.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {roles.map((role) => (
            <Col xs={24} sm={12} lg={8} key={role.name}>
              {renderRoleCard(role)}
            </Col>
          ))}
        </Row>
      )}

      {/* ── 管理员列表 ── */}
      <Table<AdminUserItem>
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 800 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total: number) => `共 ${total} 条`,
        }}
        locale={{ emptyText: '暂无管理员数据' }}
      />

      {/* ── 新增管理员弹窗 ── */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>新增管理员</span>
          </Space>
        }
        open={createModalOpen}
        onOk={handleCreateSubmit}
        onCancel={handleCreateCancel}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 个字符' },
            ]}
          >
            <Input placeholder="输入用户名" autoComplete="off" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少 6 个字符' },
            ]}
          >
            <Input.Password
              placeholder="输入密码"
              autoComplete="new-password"
              visibilityToggle
            />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
            initialValue="admin"
          >
            <Select
              placeholder="选择角色"
              options={ROLE_OPTIONS}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 修改角色弹窗 ── */}
      <Modal
        title={`修改角色 - ${selectedUser?.username ?? ''}`}
        open={roleModalOpen}
        onOk={handleRoleChangeSubmit}
        onCancel={handleRoleChangeCancel}
        confirmLoading={roleMutation.isPending}
        okText="确认修改"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            当前角色：
            {selectedUser && (
              <Tag color={ROLE_COLORS[selectedUser.role]} style={{ marginLeft: 8 }}>
                {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
              </Tag>
            )}
          </Text>
          <Select<AdminRole>
            value={newRole}
            onChange={(value: AdminRole) => { setNewRole(value) }}
            style={{ width: '100%' }}
            options={ROLE_OPTIONS}
          />
        </div>
      </Modal>
    </div>
  )
}

export default Admin
