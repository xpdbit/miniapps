/**
 * TavernCards — 官方卡片管理页面
 * 分栏布局：左侧卡片列表 + 右侧卡片详情
 * 管理角色卡/机制卡/地图卡/背景卡
 * 功能：筛选、创建、删除、多选、锁定
 */
import { useState, useCallback, useMemo } from 'react'
import {
  Button, Card, Input, Select, Space, Tag, Typography, Popconfirm, message,
  Modal, Form, Empty, Alert, Tooltip, Checkbox, Descriptions,
} from 'antd'
import {
  SearchOutlined, PlusOutlined,
  LockOutlined, UnlockOutlined, DeleteOutlined,
  EditOutlined, FileTextOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tavernAdminApi } from '@/services/tavern'
import type { TavernCharacter } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import dayjs from 'dayjs'

const { Text, Paragraph } = Typography

// ─── 常量 ──────────────────────────────────────────────────────────────

const CARD_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'CHARACTER', label: '角色卡' },
  { value: 'MECHANISM', label: '机制卡' },
  { value: 'MAP', label: '地图卡' },
  { value: 'BACKGROUND', label: '背景卡' },
]

const CARD_TYPE_LABELS: Record<string, string> = {
  CHARACTER: '角色卡',
  MECHANISM: '机制卡',
  MAP: '地图卡',
  BACKGROUND: '背景卡',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审核', color: 'orange' },
  PUBLISHED: { label: '已发布', color: 'green' },
  BANNED: { label: '已封禁', color: 'red' },
}

// ─── 工具函数 ──────────────────────────────────────────────────────────

/** 展开 Tavern API 响应：{ code, data, message } → data */
function unwrapTavernResponse<T>(responseData: unknown): T {
  const body = responseData as { code?: number; data?: T }
  return body?.data as T
}

// ─── 组件 ──────────────────────────────────────────────────────────────

export default function TavernCards() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedCard, setSelectedCard] = useState<TavernCharacter | null>(null)

  // 创建/编辑模态框
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()

  // ─── 数据查询 ──────────────────────────────────────────────────────

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tavern-cards', page, search, typeFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, pageSize: 20 }
      if (typeFilter) params.cardType = typeFilter
      if (search) params.search = search
      const res = await tavernAdminApi.getCharacters(params)
      // 展开 Tavern API 包装
      return unwrapTavernResponse<{ items: TavernCharacter[]; total: number }>(res.data) ?? { items: [], total: 0 }
    },
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['tavern-cards'] })
  }, [qc])

  const items = data?.items ?? []
  const total = data?.total ?? 0

  // ─── Mutations ─────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.deleteCharacter(id),
    onSuccess: () => { message.success('卡片已删除'); invalidate(); if (selectedCard) setSelectedCard(null) },
    onError: () => message.error('删除失败'),
  })

  const lockMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.lockCharacter(id),
    onSuccess: () => { message.success('卡片已锁定'); invalidate() },
    onError: () => message.error('锁定失败'),
  })

  const unlockMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.unlockCharacter(id),
    onSuccess: () => { message.success('卡片已解锁'); invalidate() },
    onError: () => message.error('解锁失败'),
  })

  /** 从 Axios 错误中提取服务端错误消息 */
  function extractError(err: unknown): string {
    const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
    return axiosErr.response?.data?.message ?? axiosErr.message ?? '操作失败'
  }

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => tavernAdminApi.deleteCharacter(id)))
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => extractError(r.reason))
      const uniqueErrors = [...new Set(errors)]
      if (succeeded > 0) {
        message.success(
          `已删除 ${succeeded} 张卡片` +
          (failed > 0 ? `，${failed} 张失败：${uniqueErrors.join('；')}` : '')
        )
      } else {
        throw new Error(uniqueErrors.join('；') || '批量删除失败')
      }
      return succeeded
    },
    onSuccess: () => { setSelectedIds([]); invalidate() },
    onError: (err) => message.error(extractError(err)),
  })

  // ─── 操作处理 ─────────────────────────────────────────────────────

  const handleSelectCard = useCallback((card: TavernCharacter) => {
    setSelectedCard(card)
  }, [])

  const handleCreate = useCallback(() => {
    setEditingId(null)
    form.resetFields()
    setFormOpen(true)
  }, [form])

  const handleEdit = useCallback((card: TavernCharacter) => {
    setEditingId(card.id)
    form.setFieldsValue({
      name: card.name,
      description: card.description ?? '',
      cardType: card.cardType ?? 'CHARACTER',
      tags: Array.isArray(card.tags) ? card.tags.join(', ') : '',
      avatar: card.avatar ?? '',
      personality: card.personality ?? '',
      scenario: card.scenario ?? '',
      firstMsg: card.firstMsg ?? '',
    })
    setFormOpen(true)
  }, [form])

  const handleFormSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const tags = values.tags
        ? String(values.tags).split(',').map((t: string) => t.trim()).filter(Boolean)
        : []
      const payload = { ...values, tags }

      if (editingId) {
        await tavernAdminApi.updateCharacter(editingId, payload)
        message.success('卡片已更新')
      } else {
        await tavernAdminApi.createCharacter(payload)
        message.success('卡片已创建')
      }
      setFormOpen(false)
      invalidate()
    } catch (err) {
      message.error(extractError(err) || '操作失败，请重试')
    }
  }, [editingId, form, invalidate])

  // ─── 选中卡片详情（实时同步最新数据） ──────────────────────────────

  const detailCard = useMemo(() => {
    if (!selectedCard) return null
    return items.find((c) => c.id === selectedCard.id) ?? selectedCard
  }, [selectedCard, items])

  // ─── 渲染 ──────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="卡片管理"
        onRefresh={() => refetch()}
        extra={
          <Space>
            {selectedIds.length > 0 && (
              <>
                <Text type="secondary">已选 {selectedIds.length} 项</Text>
                <Popconfirm
                  title="批量删除"
                  description={`确认删除 ${selectedIds.length} 张卡片？`}
                  onConfirm={() => batchDeleteMutation.mutate(selectedIds)}
                >
                  <Button danger icon={<DeleteOutlined />}>批量删除</Button>
                </Popconfirm>
              </>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建卡片
            </Button>
          </Space>
        }
      />

      {isError && (
        <Alert
          type="error" showIcon
          message="卡片列表加载失败"
          action={<Button size="small" onClick={() => refetch()}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ─── 分栏布局 ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 180px)' }}>
        {/* ── 左侧：列表 ── */}
        <div style={{ width: '40%', minWidth: 360, display: 'flex', flexDirection: 'column' }}>
          {/* 筛选栏 */}
          <Card size="small" style={{ marginBottom: 8, flexShrink: 0 }}>
            <Space wrap style={{ width: '100%' }}>
              <Input.Search
                placeholder="搜索卡片名称"
                allowClear
                style={{ width: 180 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={() => setPage(1)}
                enterButton={<SearchOutlined />}
              />
              <Select
                placeholder="卡片类型"
                allowClear
                style={{ width: 130 }}
                value={typeFilter}
                onChange={(v) => { setTypeFilter(v); setPage(1) }}
                options={CARD_TYPES}
              />
            </Space>
          </Card>

          {/* 卡片列表 */}
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            {isLoading ? (
              <PageSkeleton type="table" />
            ) : items.length === 0 ? (
              <Empty description="暂无卡片" style={{ padding: 40 }} />
            ) : (
              items.map((card) => {
                const isSelected = selectedCard?.id === card.id
                const typeLabel = CARD_TYPE_LABELS[card.cardType ?? ''] ?? card.cardType ?? '角色卡'

                return (
                  <div
                    key={card.id}
                    onClick={() => handleSelectCard(card)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      background: isSelected ? '#e6f4ff' : undefined,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(card.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        setSelectedIds((prev) =>
                          e.target.checked
                            ? [...prev, card.id]
                            : prev.filter((id) => id !== card.id)
                        )
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text strong style={{ fontSize: 13 }} ellipsis>{card.name}</Text>
                        {card.locked && <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: '14px' }}>锁定</Tag>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Tag style={{ margin: 0, fontSize: 10, lineHeight: '14px' }}>{typeLabel}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(card.createdAt).format('MM-DD')}
                        </Text>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* 分页 */}
            {total > 20 && (
              <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'center', gap: 4 }}>
                <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  上一页
                </Button>
                <Text style={{ fontSize: 12, lineHeight: '24px' }}>
                  {page} / {Math.ceil(total / 20)}
                </Text>
                <Button size="small" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)}>
                  下一页
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── 右侧：详情 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {detailCard ? (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>{detailCard.name}</span>
                  {detailCard.locked && <Tag color="orange">已锁定</Tag>}
                  <Tag color={STATUS_CONFIG[detailCard.status]?.color ?? 'default'}>
                    {STATUS_CONFIG[detailCard.status]?.label ?? detailCard.status}
                  </Tag>
                </Space>
              }
              extra={
                <Space>
                  <Tooltip title={detailCard.locked ? '解锁卡片' : '锁定卡片'}>
                    <Button
                      size="small"
                      icon={detailCard.locked ? <UnlockOutlined /> : <LockOutlined />}
                      onClick={() => {
                        if (detailCard.locked) {
                          unlockMutation.mutate(detailCard.id)
                        } else {
                          lockMutation.mutate(detailCard.id)
                        }
                      }}
                    >
                      {detailCard.locked ? '解锁' : '锁定'}
                    </Button>
                  </Tooltip>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(detailCard)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title={`确认删除「${detailCard.name}」？`}
                    description={detailCard.locked ? '卡片已锁定，无法删除' : '删除后将无法恢复'}
                    onConfirm={() => deleteMutation.mutate(detailCard.id)}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={detailCard.locked}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="UUID">
                  <Text copyable style={{ fontSize: 12 }}>{detailCard.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="名称">{detailCard.name}</Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag>{CARD_TYPE_LABELS[detailCard.cardType ?? ''] ?? detailCard.cardType ?? '角色卡'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS_CONFIG[detailCard.status]?.color ?? 'default'}>
                    {STATUS_CONFIG[detailCard.status]?.label ?? detailCard.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="是否官方">
                  {detailCard.isOfficial ? <Tag color="blue">官方</Tag> : <Tag>用户创建</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="锁定状态">
                  {detailCard.locked ? <Tag color="orange">已锁定</Tag> : <Tag color="green">未锁定</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="创建者">
                  {detailCard.creator?.nickname || '系统'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(detailCard.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(detailCard.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="描述">
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {detailCard.description || '-'}
                  </Paragraph>
                </Descriptions.Item>
              </Descriptions>

              {/* JSON 详情 */}
              <Card
                size="small"
                title="JSON 数据"
                type="inner"
                extra={
                  <Button
                    size="small"
                    onClick={() => {
                      const json = JSON.stringify(detailCard, null, 2)
                      navigator.clipboard.writeText(json).catch(() => {})
                      message.success('已复制 JSON')
                    }}
                  >
                    复制
                  </Button>
                }
              >
                <pre
                  style={{
                    fontSize: 11,
                    lineHeight: 1.5,
                    maxHeight: 400,
                    overflow: 'auto',
                    background: '#f6f8fa',
                    padding: 12,
                    borderRadius: 6,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(detailCard, null, 2)}
                </pre>
              </Card>
            </Card>
          ) : (
            <Card>
              <Empty
                description="从左侧列表选择一张卡片查看详情"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: 80 }}
              />
            </Card>
          )}
        </div>
      </div>

      {/* ─── 创建/编辑模态框 ────────────────────────────────────────── */}
      <Modal
        title={editingId ? '编辑卡片' : '新建卡片'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleFormSubmit}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入卡片名称' }]}>
            <Input placeholder="卡片名称" />
          </Form.Item>
          <Form.Item name="cardType" label="卡片类型" initialValue="CHARACTER">
            <Select options={CARD_TYPES.filter((o) => o.value !== '')} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="卡片描述" />
          </Form.Item>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Input placeholder="例如：科幻, 机娘, 治愈" />
          </Form.Item>
          <Form.Item name="personality" label="人格特征">
            <Input.TextArea rows={2} placeholder="角色的性格特点" />
          </Form.Item>
          <Form.Item name="scenario" label="场景设定">
            <Input.TextArea rows={2} placeholder="对话发生的场景" />
          </Form.Item>
          <Form.Item name="firstMsg" label="开场白">
            <Input.TextArea rows={2} placeholder="角色的第一句话" />
          </Form.Item>
          <Form.Item name="avatar" label="头像 URL">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
