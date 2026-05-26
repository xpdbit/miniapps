import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Tag, Card, Row, Col, Statistic, Button, Space, message, Tooltip } from 'antd'
import { CommentOutlined, AppstoreOutlined, UserOutlined, KeyOutlined, FileTextOutlined, CloudDownloadOutlined } from '@ant-design/icons'
import { ROUTES } from '@/constants/routes'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import type { TavernStats } from '@/services/tavern'

export default function TavernPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['tavern-stats'],
    queryFn: async () => {
      const res = await tavernAdminApi.getStats()
      return unwrapTavernResponse<TavernStats>(res.data)
    },
  })

  // ── 模型统计 ──
  const { data: modelStats, isLoading: modelStatsLoading } = useQuery({
    queryKey: ['tavern-model-stats'],
    queryFn: async () => {
      try {
        const res = await tavernAdminApi.getModelStats()
        return unwrapTavernResponse<{ total: number; active: number; byProvider: Array<{ provider: string; _count: { modelId: number } }> }>(res.data)
      } catch {
        return null
      }
    },
    refetchInterval: 60_000, // 每分钟自动刷新
  })

  // ── 模型同步 ──
  const syncMutation = useMutation({
    mutationFn: () => tavernAdminApi.syncModels(),
    onSuccess: (res) => {
      const data = unwrapTavernResponse<{ summary: { success: number; failed: number; added: number; updated: number }; results: Array<{ provider: string; error?: string }> }>(res.data)
      if (data?.summary) {
        const { success, failed, added, updated } = data.summary
        if (failed === 0) {
          void message.success(`同步完成: ${success} 个服务商, 新增 ${added} 个, 更新 ${updated} 个`)
        } else {
          void message.warning(`同步完成: ${success}/${success + failed} 成功, 新增 ${added} 个, 更新 ${updated} 个`)
        }
      }
      queryClient.invalidateQueries({ queryKey: ['tavern-model-stats'] })
    },
    onError: () => {
      void message.error('模型同步失败，请检查服务商配置')
    },
  })

  // ── 刷新所有 tavern 数据 ──
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tavern-stats'] })
    queryClient.invalidateQueries({ queryKey: ['tavern-model-stats'] })
  }

  if (statsLoading) return <PageSkeleton type="table" />

  // ── 模型服务商 Tag 颜色映射 ──
  const providerColors: Record<string, string> = {
    tongyi: 'blue', opencode: 'purple', openai: 'green', deepseek: 'cyan',
    anthropic: 'orange', google: 'red', zhipu: 'volcano', moonshot: 'gold',
    minimax: 'magenta', openrouter: 'geekblue', oneapi: 'lime',
  }

  return (
    <div>
      <PageHeader
        title="AI 酒馆管理"
        onRefresh={handleRefresh}
        extra={
          <Space>
            <Tooltip title="从 One API 等服务商同步最新模型列表">
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
              >
                同步模型
              </Button>
            </Tooltip>
          </Space>
        }
      />

      {/* ── 子页面导航 ── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<AppstoreOutlined />} onClick={() => navigate(ROUTES.TAVERN)} type="primary" ghost>
            概览
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => navigate(ROUTES.TAVERN_CARDS)}>
            卡片管理
          </Button>
          <Button icon={<CommentOutlined />} onClick={() => navigate(ROUTES.TAVERN_CHATS)}>
            聊天监控
          </Button>
          <Button icon={<KeyOutlined />} onClick={() => navigate(ROUTES.TAVERN_KEYS)}>
            Key 管理
          </Button>
          <Button icon={<UserOutlined />} onClick={() => navigate(ROUTES.TAVERN_USERS)}>
            用户管理
          </Button>
          <Button icon={<AppstoreOutlined />} onClick={() => navigate(ROUTES.TAVERN_MODELS)}>
            模型管理
          </Button>
        </Space>
      </Card>

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

      {/* ── 模型统计 ── */}
      {modelStats && !modelStatsLoading && (
        <Card size="small" title="模型概况" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="模型总数" value={modelStats.total} />
            </Col>
            <Col span={6}>
              <Statistic title="启用中" value={modelStats.active} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={12}>
              <Space wrap>
                {modelStats.byProvider.map((p) => (
                  <Tag key={p.provider} color={providerColors[p.provider] ?? 'default'}>
                    {p.provider}: {p._count.modelId}
                  </Tag>
                ))}
              </Space>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  )
}