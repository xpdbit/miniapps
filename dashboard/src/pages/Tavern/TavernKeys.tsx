/**
 * TavernKeys — Key 管理页面
 * 展示用户 API Key 列表，支持吊销操作
 */
import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Card,
  Space,
  Input,
  Popconfirm,
  message,
  Tag,
  Empty,
  Alert,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import type { TavernApiKeyItem, TavernApiKeyListResponse } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

const TavernKeys = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchUser, setSearchUser] = useState('')

  // ── 查询 ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tavern-keys', page],
    queryFn: async () => {
      const res = await tavernAdminApi.getApiKeys({ page, pageSize: 20 })
      return unwrapTavernResponse<TavernApiKeyListResponse>(res.data)
    },
  })

  // ── 吊销 ──
  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => tavernAdminApi.revokeApiKey(keyId),
    onSuccess: () => {
      message.success('API Key 已吊销')
      queryClient.invalidateQueries({ queryKey: ['tavern-keys'] })
    },
    onError: () => {
      message.error('吊销失败，请重试')
    },
  })

  // ── 表格列 ──
  const columns: ColumnsType<TavernApiKeyItem> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 140,
      render: (v: string) => v || '匿名',
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (v: string) => <Tag color="blue">{v || '-'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean) =>
        active ? <Tag color="green">启用</Tag> : <Tag color="red">已吊销</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: unknown, record: TavernApiKeyItem) =>
        record.isActive ? (
          <Popconfirm
            title="确认吊销"
            description="吊销后该 Key 将无法使用，确认执行？"
            onConfirm={() => revokeMutation.mutate(record.id)}
            okText="确认吊销"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<StopOutlined />}>
              吊销
            </Button>
          </Popconfirm>
        ) : (
          <Text type="secondary">已吊销</Text>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Key 管理"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tavern-keys'] })}
      />

      {/* 筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索用户"
            allowClear
            style={{ width: 200 }}
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            onSearch={() => setPage(1)}
            enterButton={<SearchOutlined />}
          />
        </Space>
      </Card>

      {/* 错误态 */}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="Key 列表加载失败"
          action={<Button size="small" icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['tavern-keys'] })}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 表格 */}
      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table<TavernApiKeyItem>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条 Key`,
          }}
          locale={{ emptyText: <Empty description="暂无 API Key" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </div>
  )
}

export default TavernKeys
