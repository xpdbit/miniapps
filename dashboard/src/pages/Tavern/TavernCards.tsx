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
  Upload, Divider,
} from 'antd'
import {
  SearchOutlined, PlusOutlined,
  LockOutlined, UnlockOutlined, DeleteOutlined,
  EditOutlined, FileTextOutlined,
  ImportOutlined, InboxOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
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

  // JSON 导入
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null)

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
      prompt: card.prompt ?? '',
      tags: Array.isArray(card.tags) ? card.tags.join(', ') : '',
      avatar: card.avatar ?? '',
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

  // ─── JSON 导入处理 ───────────────────────────────────────────────

  /** 解析 JSON 文本，显示预览 */
  const handleParseJson = useCallback(() => {
    setImportResult(null)
    if (!importJson.trim()) {
      setImportPreview(null)
      return
    }
    try {
      const parsed = JSON.parse(importJson)
      const cards = Array.isArray(parsed) ? parsed : [parsed]
      if (cards.length === 0) {
        message.warning('JSON 数组为空')
        setImportPreview(null)
        return
      }
      if (!cards.every((c: unknown) => typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).name === 'string')) {
        message.warning('JSON 格式不正确：每张卡片必须包含 name 字段')
        setImportPreview(null)
        return
      }
      setImportPreview(cards as Record<string, unknown>[])
    } catch {
      message.error('JSON 解析失败，请检查格式')
      setImportPreview(null)
    }
  }, [importJson])

  /** 执行导入 */
  const handleImport = useCallback(async () => {
    if (!importPreview || importPreview.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await tavernAdminApi.importCards(importPreview)
      const result = unwrapTavernResponse<{ created: number; failed: number; errors: string[] }>(res.data)
      setImportResult(result)
      if (result.created > 0) {
        message.success(`成功导入 ${result.created} 张卡片${result.failed > 0 ? `，${result.failed} 张失败` : ''}`)
        invalidate()
      } else {
        message.error('导入失败：' + (result.errors?.[0] || '未知错误'))
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      message.error(axiosErr.response?.data?.message || '导入请求失败')
    } finally {
      setImporting(false)
    }
  }, [importPreview, invalidate])

  /** 关闭导入弹窗时清理状态 */
  const handleCloseImport = useCallback(() => {
    setImportOpen(false)
    setImportJson('')
    setImportPreview(null)
    setImportResult(null)
  }, [])

  // 从导出文件格式中提取卡片数组
  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string
        const parsed = JSON.parse(raw)
        // 支持两种格式：直接卡片数组 或 导出包装格式 { cards: [...] }
        const cards = Array.isArray(parsed) ? parsed : parsed.cards || parsed.data || [parsed]
        setImportJson(JSON.stringify(cards, null, 2))
        setImportPreview(cards as Record<string, unknown>[])
        message.success(`已加载 ${cards.length} 张卡片`)
      } catch {
        message.error('文件解析失败，请确认是有效的 JSON 文件')
      }
    }
    reader.readAsText(file)
    return false // 阻止 Upload 自动上传
  }, [])

  // ─── 选中卡片详情（实时同步最新数据） ──────────────────────────────

  const detailCard = useMemo(() => {
    if (!selectedCard) return null
    return items.find((c) => c.id === selectedCard.id) ?? selectedCard
  }, [selectedCard, items])

  /** 额外 JSON 字段（不在主界面显示的） */
  const extraFields = useMemo(() => {
    if (!detailCard) return []
    const dc = detailCard as unknown as Record<string, unknown>
    return [
      { label: 'prompt', value: dc.prompt },
      { label: 'cardSpec', value: dc.cardSpec },
      { label: 'modelPreference', value: dc.modelPreference },
      { label: 'temperature', value: dc.temperature },
      { label: 'version', value: dc.version },
    ].filter(f => f.value !== undefined && f.value !== null && f.value !== '')
  }, [detailCard])

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
            <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
              导入 JSON
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
                const typeLabel = CARD_TYPE_LABELS[card.cardType ?? ''] ?? card.cardType ?? '角色卡'

                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      setSelectedIds((prev) =>
                        prev.includes(card.id)
                          ? prev.filter((id) => id !== card.id)
                          : [...prev, card.id]
                      )
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      background: selectedCard?.id === card.id ? '#e6f4ff' : selectedIds.includes(card.id) ? '#f0f5ff' : undefined,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (selectedCard?.id !== card.id) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={(e) => { if (selectedCard?.id !== card.id) e.currentTarget.style.background = 'transparent' }}
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
                    <div
                      style={{ flex: 1, minWidth: 0 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectCard(card)
                      }}
                    >
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

              {/* JSON 详情 — 完整字段 + 原始 JSON */}
              <Card
                size="small"
                title="JSON 数据（完整字段）"
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
                <div style={{ maxHeight: 420, overflow: 'auto' }}>
                  {/* 隐藏/附加字段 */}
                  {extraFields.length > 0 ? (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 8 }}>
                      <thead>
                        <tr style={{ background: '#f6f8fa' }}>
                          <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '2px solid #e8e8e8', width: 120 }}>字段</th>
                          <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '2px solid #e8e8e8' }}>值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraFields.map(f => (
                          <tr key={f.label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '3px 8px', fontWeight: 600, color: '#666', verticalAlign: 'top' }}>{f.label}</td>
                            <td style={{ padding: '3px 8px', wordBreak: 'break-all' }}>
                              {typeof f.value === 'object'
                                ? <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.4, maxHeight: 120, overflow: 'auto', background: '#f6f8fa', padding: 4, borderRadius: 4 }}>{JSON.stringify(f.value, null, 2)}</pre>
                                : String(f.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: '8px 0', fontSize: 12 }}>无附加字段</div>
                  )}

                  {/* 原始 JSON */}
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#1677ff', marginBottom: 8 }}>
                      查看原始 JSON
                    </summary>
                    <pre
                      style={{
                        fontSize: 11,
                        lineHeight: 1.5,
                        maxHeight: 300,
                        overflow: 'auto',
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 12,
                        borderRadius: 6,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(detailCard, null, 2)}
                    </pre>
                  </details>
                </div>
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

      {/* ─── JSON 导入模态框 ────────────────────────────────────────── */}
      <Modal
        title="导入卡片 JSON"
        open={importOpen}
        onCancel={handleCloseImport}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {/* 文件上传 */}
        <Upload.Dragger
          accept=".json"
          showUploadList={false}
          beforeUpload={handleFileRead}
          style={{ marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 JSON 文件到此处</p>
          <p className="ant-upload-hint">支持 .json 文件，自动识别卡片数组或导出格式</p>
        </Upload.Dragger>

        <Divider plain>或手动粘贴 JSON</Divider>

        <Input.TextArea
          rows={10}
          placeholder={`粘贴卡片 JSON 数组，例如：
[
  {
    "name": "示例角色",
    "description": "角色描述...",
    "cardType": "CHARACTER",
    "prompt": "你是一个...（角色设定提示词，含场景设定和开场白）",
    "tags": ["科幻", "治愈"]
  }
]`}
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />

        <Space style={{ marginTop: 12, marginBottom: 12 }}>
          <Button onClick={handleParseJson} icon={<SearchOutlined />}>
            解析 JSON
          </Button>
          <Button
            type="primary"
            icon={<ImportOutlined />}
            loading={importing}
            disabled={!importPreview || importPreview.length === 0}
            onClick={handleImport}
          >
            导入 {importPreview ? `${importPreview.length} 张卡片` : ''}
          </Button>
        </Space>

        {/* 导入进度 */}
        {importResult && (
          <Alert
            type={importResult.failed === 0 ? 'success' : 'warning'}
            showIcon
            message={
              <span>
                导入完成：成功 {importResult.created} 张
                {importResult.failed > 0 && `，失败 ${importResult.failed} 张`}
              </span>
            }
            description={
              importResult.errors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : undefined
            }
            style={{ marginBottom: 12 }}
          />
        )}

        {/* 预览表格 */}
        {importPreview && importPreview.length > 0 && (
          <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>名称</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>类型</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>描述</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>标签</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((card, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '4px 12px' }}>{card.name as string}</td>
                    <td style={{ padding: '4px 12px' }}>
                      <Tag style={{ margin: 0, fontSize: 11 }}>{(card.cardType as string) || 'CHARACTER'}</Tag>
                    </td>
                    <td style={{ padding: '4px 12px', maxWidth: 200 }}>
                      <Text ellipsis style={{ fontSize: 11 }}>{(card.description as string) || '-'}</Text>
                    </td>
                    <td style={{ padding: '4px 12px' }}>
                      {Array.isArray(card.tags) && (card.tags as string[]).length > 0
                        ? (card.tags as string[]).slice(0, 3).map((t) => (
                          <Tag key={t} style={{ margin: 1, fontSize: 10 }}>{t}</Tag>
                        ))
                        : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>}
                      {Array.isArray(card.tags) && (card.tags as string[]).length > 3 && (
                        <Text type="secondary" style={{ fontSize: 10 }}> +{(card.tags as string[]).length - 3}</Text>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ─── 创建/编辑模态框 ────────────────────────────────────────── */}
      <Modal
        title={editingId ? '编辑卡片' : '新建卡片'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleFormSubmit}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="UUID">
            <Input value={editingId ?? '创建后自动生成'} disabled />
          </Form.Item>
          <Form.Item name="name" label="卡片名称" rules={[{ required: true, message: '请输入卡片名称' }]}>
            <Input placeholder="卡片名称" />
          </Form.Item>
          <Form.Item name="description" label="卡片简介">
            <Input.TextArea rows={3} placeholder="卡片简要描述" />
          </Form.Item>
          <Form.Item name="prompt" label="卡片提示词">
            <Input.TextArea rows={6} placeholder="定义 AI 角色行为逻辑、性格特征、背景知识和对话风格的系统提示词" />
          </Form.Item>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Input placeholder="例如：科幻, 机娘, 治愈" />
          </Form.Item>
          <Form.Item name="avatar" label="头像 URL">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
