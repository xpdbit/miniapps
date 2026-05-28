/**
 * TavernUsers — AI 酒馆用户管理页面
 * 支持：用户列表/搜索/封禁解封/角色修改
 */
import { useState } from 'react'
import {
  Table, Button, Card, Space, Tag, Input, Popconfirm,
  message, Select, Typography,
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import type { TavernUserItem, TavernUserListResponse } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import type { ColumnsType } from 'antd/es/table'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'green' },
  disabled: { label: '已封禁', color: 'red' },
}

export default function TavernUsers() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tavern-users', page, search],
    queryFn: async () => {
      const res = await tavernAdminApi.getUsers({ page, pageSize: 20, search: search || undefined })
      return unwrapTavernResponse<TavernUserListResponse>(res.data)
    },
  })

  const banMutation = useMutation({
    mutationFn: ({ uuid, action }: { uuid: string; action: 'ban' | 'unban' }) =>
      tavernAdminApi.banUser(uuid, action),
    onSuccess: (_data, variables) => {
      void message.success(variables.action === 'ban' ? '已封禁' : '已解封')
      void qc.invalidateQueries({ queryKey: ['tavern-users'] })
    },
    onError: () => {
      void message.error('操作失败')
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ uuid, role }: { uuid: string; role: 'USER' | 'ADMIN' }) =>
      tavernAdminApi.updateUserRole(uuid, role),
    onSuccess: () => {
      void message.success('角色已更新')
      void qc.invalidateQueries({ queryKey: ['tavern-users'] })
    },
    onError: () => {
      void message.error('操作失败')
    },
  })

  const columns: ColumnsType<TavernUserItem> = [
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 160,
    },
    {
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
      width: 120,
      ellipsis: true,
      render: (v: string) => <Typography.Text copyable style={{ fontSize: 12 }}>{v.slice(0, 12)}...</Typography.Text>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string, record: TavernUserItem) => (
        <Select
          size="small"
          value={role as 'USER' | 'ADMIN'}
          style={{ width: 100 }}
          onChange={(newRole) => {
            roleMutation.mutate({ uuid: record.uuid, role: newRole })
          }}
          options={[
            { value: 'USER', label: '用户' },
            { value: 'ADMIN', label: '管理员' },
          ]}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '会话数',
      dataIndex: 'sessionCount',
      key: 'sessionCount',
      width: 80,
      align: 'right',
    },
    {
      title: '消息数',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 80,
      align: 'right',
    },
    {
      title: '卡片数',
      dataIndex: 'cardCount',
      key: 'cardCount',
      width: 70,
      align: 'right',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: TavernUserItem) => (
        <Space>
          {record.status === 'active' ? (
            <Popconfirm
              title="确认封禁该用户？"
              description="封禁后该用户将无法登录"
              onConfirm={() => banMutation.mutate({ uuid: record.uuid, action: 'ban' })}
            >
              <Button type="link" danger icon={<StopOutlined />}>封禁</Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确认解封该用户？"
              onConfirm={() => banMutation.mutate({ uuid: record.uuid, action: 'unban' })}
            >
              <Button type="link" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }}>解封</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  if (isLoading) return <PageSkeleton type="table" />

  return (
    <div>
      <PageHeader
        title="用户管理"
        extra={
          <Space>
            <Input
              placeholder="搜索昵称"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 200 }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => qc.invalidateQueries({ queryKey: ['tavern-users'] })}
            >
              刷新
            </Button>
          </Space>
        }
      />

      <Card>
        <Table
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="uuid"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个用户`,
          }}
        />
      </Card>
    </div>
  )
}
