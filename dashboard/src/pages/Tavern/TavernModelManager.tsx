/**
 * TavernModelManager — AI 模型管理页面
 * 展示所有 AI 模型列表，支持启用/禁用、服务商筛选、搜索、同步
 */
import { useState, useMemo } from 'react'
import {
  Typography,
  Table,
  Button,
  Card,
  Space,
  Input,
  Select,
  Switch,
  Tag,
  message,
  Alert,
  Empty,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import type { TavernModelItem, TavernModelListResponse } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

const PROVIDER_COLORS: Record<string, string> = {
  tongyi: 'blue', opencode: 'purple', openai: 'green', deepseek: 'cyan',
  anthropic: 'orange', google: 'red', zhipu: 'volcano', moonshot: 'gold',
  minimax: 'magenta', openrouter: 'geekblue', oneapi: 'lime',
}

const TIER_COLORS: Record<string, string> = {
  FREE: 'green', PAID: 'gold', TESTER: 'purple',
}

const TIER_LABELS: Record<string, string> = {
  FREE: '免费', PAID: '付费', TESTER: '测试',
}

const TavernModelManager = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [providerFilter, setProviderFilter] = useState<string | undefined>()
  const [searchText, setSearchText] = useState('')

  /** 检查响应码并展开 */
  function handleResponse<T>(res: { data: unknown }): T {
    const body = res.data as { code?: number; data?: T; message?: string }
    if (body.code !== undefined && body.code !== 0) {
      throw new Error(body.message || `服务器返回错误 (code=${body.code})`)
    }
    if (!body.data) {
      throw new Error(body.message || '响应数据为空')
    }
    return body.data
  }

  // ── 模型列表 ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tavern-models', page, providerFilter, searchText],
    queryFn: async () => {
      const res = await tavernAdminApi.getModels({
        page,
        pageSize,
        provider: providerFilter || undefined,
        search: searchText || undefined,
      })
      return handleResponse<TavernModelListResponse>(res)
    },
    retry: 1,
  })

  // ── 模型统计 ──
  const { data: stats } = useQuery({
    queryKey: ['tavern-model-stats'],
    queryFn: async () => {
      const res = await tavernAdminApi.getModelStats()
      return handleResponse<{
        total: number; active: number;
        byProvider: Array<{ provider: string; _count: { modelId: number } }>
      }>(res)
    },
    refetchInterval: 60_000,
    retry: 1,
  })

  // ── 启用/禁用 ──
  const toggleMutation = useMutation({
    mutationFn: ({ modelId, isActive }: { modelId: string; isActive: boolean }) =>
      tavernAdminApi.updateModel(modelId, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tavern-models'] })
      void queryClient.invalidateQueries({ queryKey: ['tavern-model-stats'] })
    },
    onError: () => void message.error('操作失败'),
  })

  // ── 同步模型 ──
  const syncMutation = useMutation({
    mutationFn: () => tavernAdminApi.syncModels(),
    onSuccess: (res) => {
      const data = unwrapTavernResponse<{ summary: { added: number; updated: number } }>(res.data)
      void message.success(`同步完成: 新增 ${data?.summary?.added ?? 0}, 更新 ${data?.summary?.updated ?? 0}`)
      void queryClient.invalidateQueries({ queryKey: ['tavern-models'] })
      void queryClient.invalidateQueries({ queryKey: ['tavern-model-stats'] })
    },
    onError: () => void message.error('同步失败'),
  })

  // ── 服务商选项（从统计中提取） ──
  const providerOptions = useMemo(() => {
    if (!stats?.byProvider) return []
    return stats.byProvider.map(p => ({
      value: p.provider,
      label: `${p.provider} (${p._count.modelId})`,
    }))
  }, [stats])

  // ── 表格列 ──
  const columns: ColumnsType<TavernModelItem> = [
    {
      title: '模型 ID',
      dataIndex: 'modelId',
      key: 'modelId',
      width: 180,
      ellipsis: true,
    },
    {
      title: '名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 160,
      render: (v: string, record: TavernModelItem) => (
        <Space size={4}>
          <Text>{record.icon ?? ''} {v}</Text>
        </Space>
      ),
    },
    {
      title: '服务商',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (v: string) => (
        <Tag color={PROVIDER_COLORS[v] ?? 'default'}>{v}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean, record: TavernModelItem) => (
        <Tooltip title={active ? '点击禁用' : '点击启用'}>
          <Switch
            checked={active}
            size="small"
            loading={toggleMutation.isPending}
            onChange={(checked) => {
              toggleMutation.mutate({ modelId: record.modelId, isActive: checked })
            }}
          />
        </Tooltip>
      ),
    },
    {
      title: '最低等级',
      dataIndex: 'minTier',
      key: 'minTier',
      width: 100,
      render: (v: string) => (
        <Tag color={TIER_COLORS[v] ?? 'default'}>{TIER_LABELS[v] ?? v}</Tag>
      ),
    },
    {
      title: '最低级别',
      dataIndex: 'minLevel',
      key: 'minLevel',
      width: 80,
      align: 'center',
    },
    {
      title: '配额消耗',
      dataIndex: 'quotaCost',
      key: 'quotaCost',
      width: 80,
      align: 'center',
      render: (v: number) => (
        <Text>{v} 次</Text>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 60,
      align: 'center',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ]

  return (
    <div>
      <PageHeader
        title="模型管理"
        extra={
          <Space>
            <Button
              icon={<CloudDownloadOutlined />}
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
            >
              同步模型
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['tavern-models'] })
                queryClient.invalidateQueries({ queryKey: ['tavern-model-stats'] })
              }}
            >
              刷新
            </Button>
          </Space>
        }
      />

      {/* 统计摘要 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>模型总数: {stats?.total ?? 0}</Text>
          <Text strong style={{ color: '#52c41a' }}>启用: {stats?.active ?? 0}</Text>
          <Text type="secondary">|</Text>
          {stats?.byProvider?.map(p => (
            <Tag key={p.provider} color={PROVIDER_COLORS[p.provider] ?? 'default'}>
              {p.provider}: {p._count.modelId}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* 筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="筛选服务商"
            allowClear
            style={{ width: 180 }}
            value={providerFilter}
            onChange={(v) => { setProviderFilter(v); setPage(1) }}
            options={providerOptions}
          />
          <Input.Search
            placeholder="搜索模型名称 / ID"
            allowClear
            style={{ width: 240 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
          message="模型列表加载失败"
          description="请确认 Tavern Server 已启动且管理 Token 配置正确。可尝试点击「同步模型」按钮拉取数据。"
          action={
            <Space>
              <Button size="small" icon={<CloudDownloadOutlined />} onClick={() => syncMutation.mutate()} loading={syncMutation.isPending}>
                同步模型
              </Button>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['tavern-models'] })}>
                重试
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 表格 */}
      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table<TavernModelItem>
          rowKey="modelId"
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 个模型`,
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space direction="vertical" align="center">
                    <span>暂无模型数据</span>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CloudDownloadOutlined />}
                      onClick={() => syncMutation.mutate()}
                      loading={syncMutation.isPending}
                    >
                      从服务商同步模型
                    </Button>
                  </Space>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      )}
    </div>
  )
}

export default TavernModelManager
