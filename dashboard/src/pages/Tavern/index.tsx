import { useState } from 'react'
import { Table, Tag, Card, Row, Col, Statistic, Button, Space, message, Popconfirm } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CommentOutlined, ReloadOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { tavernAdminApi } from '@/services/tavern'
import type { TavernCharacter, TavernStats, CharactersResponse } from '@/services/tavern'

// 兼容旧版直接 API 调用（在 tavern proxy 未到位时用）
const tavernApi = {
  getCharacters: async (params?: { page?: number; pageSize?: number }): Promise<CharactersResponse> => {
    try {
      const res = await tavernAdminApi.getCharacters(params)
      return res.data
    } catch {
      // Fallback: 直接调用 tavern-server（通过 nginx 代理）
      const axios = (await import('axios')).default
      const { getToken } = await import('@/utils/token')
      const token = getToken()
      const res = await axios.get('/api/tavern/api/v1/characters', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    }
  },
  getStats: async (): Promise<TavernStats> => {
    try {
      const res = await tavernAdminApi.getStats()
      return res.data
    } catch {
      const axios = (await import('axios')).default
      const { getToken } = await import('@/utils/token')
      const token = getToken()
      const res = await axios.get('/api/tavern/api/v1/admin/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    }
  },
  banCharacter: async (id: string): Promise<void> => {
    try {
      await tavernAdminApi.banCharacter(id, '管理员封禁')
    } catch {
      const axios = (await import('axios')).default
      const { getToken } = await import('@/utils/token')
      const token = getToken()
      await axios.post(`/api/tavern/api/v1/admin/ban/${id}`, { reason: '管理员封禁' }, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  },
}

export default function TavernPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data: characters, isLoading: charsLoading } = useQuery({
    queryKey: ['tavern-characters', page],
    queryFn: () => tavernApi.getCharacters({ page, pageSize: 20 }),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['tavern-stats'],
    queryFn: () => tavernApi.getStats(),
  })

  const handleBan = async (id: string) => {
    try {
      await tavernApi.banCharacter(id)
      void message.success('已封禁')
      queryClient.invalidateQueries({ queryKey: ['tavern-characters'] })
    } catch {
      void message.error('操作失败')
    }
  }

  const columns = [
    { title: '角色名', dataIndex: 'name', key: 'name' },
    { title: '创建者', dataIndex: ['creator', 'nickname'], key: 'creator' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = { DRAFT: 'default', PENDING: 'orange', PUBLISHED: 'green', BANNED: 'red' }
        const labels: Record<string, string> = { DRAFT: '草稿', PENDING: '待审核', PUBLISHED: '已发布', BANNED: '已封禁' }
        return <Tag color={colors[status] ?? 'default'}>{labels[status] ?? status}</Tag>
      },
    },
    { title: '对话', dataIndex: 'chatCount', key: 'chatCount', width: 80 },
    { title: '点赞', dataIndex: 'likeCount', key: 'likeCount', width: 80 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: TavernCharacter) => (
        <Space>
          {record.status !== 'BANNED' && (
            <Popconfirm title="确认封禁该角色卡？" onConfirm={() => handleBan(record.id)}>
              <Button type="link" danger>封禁</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  if (charsLoading || statsLoading) return <PageSkeleton type="table" />

  return (
    <div>
      <PageHeader
        title="AI 酒馆管理"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tavern'] })}
          >
            刷新
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总角色卡" value={stats?.totalCharacters ?? 0} prefix={<CommentOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总对话数" value={stats?.totalChats ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃用户" value={stats?.activeUsers ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待审核" value={stats?.pendingReviews ?? 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={characters?.items ?? []}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 20,
          total: characters?.total ?? 0,
          onChange: setPage,
        }}
      />
    </div>
  )
}