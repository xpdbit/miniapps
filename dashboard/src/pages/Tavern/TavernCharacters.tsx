/**
 * TavernCharacters — 角色卡片全面管理页面
 * 支持：列表/搜索/筛选/编辑/创建/批量操作/导出/JSON导入
 */
import { useState, useCallback, useRef } from 'react'
import {
  Table, Button, Card, Space, Tag, Input, Select, Popconfirm,
  message, Drawer, Descriptions, Empty, Alert, Modal, Form, Row, Col,
  Typography,
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, StopOutlined, EyeOutlined,
  PlusOutlined, ExportOutlined, EditOutlined, ImportOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import type { TavernCharacter } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import type { ColumnsType } from 'antd/es/table'

/* ================================================================
 *  常量 — 使用大写枚举值与服务端一致
 *  ================================================================ */

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'BANNED', label: '已封禁' },
  { value: 'DRAFT', label: '草稿' },
]

const CARD_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'CHARACTER', label: '角色卡' },
  { value: 'MECHANISM', label: '机制卡' },
  { value: 'MAP', label: '地图卡' },
  { value: 'BACKGROUND', label: '背景卡' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审核', color: 'orange' },
  PUBLISHED: { label: '已发布', color: 'green' },
  BANNED: { label: '已封禁', color: 'red' },
}

const CARD_TYPE_LABELS: Record<string, string> = {
  CHARACTER: '角色卡',
  MECHANISM: '机制卡',
  MAP: '地图卡',
  BACKGROUND: '背景卡',
}

interface CardFormData {
  name: string
  description: string
  tags: string
  avatar: string
  cardType: string
  prompt: string
  scenario: string
  firstMsg: string
}

const EMPTY_FORM: CardFormData = {
  name: '', description: '', tags: '', avatar: '',
  cardType: 'CHARACTER', prompt: '', scenario: '', firstMsg: '',
}

/* ================================================================
 *  组件
 *  ================================================================ */

  const TavernCharacters = () => {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 详情抽屉
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailChar, setDetailChar] = useState<TavernCharacter | null>(null)

  // 编辑/创建模态框
  const [formOpen, setFormOpen] = useState(false)
  const [formData, setFormData] = useState<CardFormData>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm<CardFormData>()

  // 导出/导入中
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  /* ============================================================
   *  数据查询 — 传递所有筛选参数
   *  ============================================================ */
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tavern-characters', page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const params: { page: number; pageSize: number; cardType?: string; status?: string } = { page, pageSize: 20 }
      if (typeFilter) params.cardType = typeFilter
      if (statusFilter) params.status = statusFilter
      const res = await tavernAdminApi.getCharacters(params)
      return unwrapTavernResponse<{ items: TavernCharacter[]; total: number }>(res.data)
    },
  })

  /* ============================================================
   *  Mutations
   *  ============================================================ */
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tavern-characters'] })

  const approveMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.approveCharacter(id),
    onSuccess: () => { message.success('已批准'); invalidate() },
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.rejectCharacter(id, '管理员拒绝'),
    onSuccess: () => { message.success('已拒绝'); invalidate() },
  })
  const banMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.banCharacter(id, '管理员封禁'),
    onSuccess: () => { message.success('已封禁'); invalidate() },
  })

  /* ============================================================
   *  操作处理
   *  ============================================================ */
  const handleViewDetail = useCallback((char: TavernCharacter) => {
    setDetailChar(char)
    setDetailOpen(true)
  }, [])

  const handleEdit = useCallback((char: TavernCharacter) => {
    setEditingId(char.id)
    const tags = Array.isArray(char.tags) ? char.tags.join(', ') : ''
    const fd: CardFormData = {
      name: char.name,
      description: char.description ?? '',
      tags,
      avatar: char.avatar ?? '',
      cardType: char.cardType ?? 'CHARACTER',
      prompt: char.prompt ?? '',
      scenario: char.scenario ?? '',
      firstMsg: char.firstMsg ?? '',
    }
    setFormData(fd)
    form.setFieldsValue(fd)
    setFormOpen(true)
  }, [form])

  const handleCreate = useCallback(() => {
    setEditingId(null)
    setFormData(EMPTY_FORM)
    form.resetFields()
    setFormOpen(true)
  }, [form])

  const handleFormSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const tags = values.tags
        ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : []
      const payload = { ...values, tags }

      if (editingId) {
        await axios.put(`/api/admin/tavern/characters/${editingId}`, payload)
        message.success('角色卡已更新')
      } else {
        await axios.post('/api/admin/tavern/characters', payload)
        message.success('角色卡已创建')
      }
      setFormOpen(false)
      invalidate()
    } catch {
      // 表单验证失败或 API 错误
    }
  }, [editingId, form, invalidate])

  const handleBatchApprove = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的卡片')
      return
    }
    try {
      await axios.post('/api/admin/tavern/batch-approve', { ids: selectedRowKeys })
      message.success(`已批量批准 ${selectedRowKeys.length} 张卡片`)
      setSelectedRowKeys([])
      invalidate()
    } catch {
      message.error('批量操作失败')
    }
  }, [selectedRowKeys, invalidate])

  const handleExport = useCallback(async () => {
    const ids = selectedRowKeys.length > 0
      ? selectedRowKeys
      : data?.items?.map((c) => c.id) ?? []
    if (ids.length === 0) {
      message.warning('没有可导出的卡片')
      return
    }
    setExporting(true)
    try {
      const res = await axios.post('/api/admin/tavern/export', { ids }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `tavern-cards-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success(`已导出 ${ids.length} 张卡片`)
    } catch {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }, [selectedRowKeys, data])

  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 文件大小校验（超过 5MB 警告，防止浏览器卡顿）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      message.error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请拆分后分批导入（单次最大 5MB）`)
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      // 支持两种格式：{ cards: [...] } 或纯数组 [...]
      const cards = Array.isArray(parsed) ? parsed : parsed.cards
      if (!Array.isArray(cards) || cards.length === 0) {
        message.error('JSON 格式无效：需要包含 cards 数组')
        return
      }

      const res = await tavernAdminApi.importCards(cards)
      const result = unwrapTavernResponse<{ created: number; failed: number; errors: string[] }>(res.data)
      if (result.failed > 0) {
        // 显示错误详情（前 5 条）
        const detailText = result.errors?.length
          ? `\n${result.errors.slice(0, 5).map((err) => `· ${err}`).join('\n')}${result.errors.length > 5 ? `\n· ...及其他 ${result.errors.length - 5} 条错误` : ''}`
          : ''
        message.warning(`导入完成：成功 ${result.created} 张，失败 ${result.failed} 张${detailText}`, 8)
      } else {
        message.success(`成功导入 ${result.created} 张卡片`)
      }
      invalidate()
    } catch (err) {
      if (err instanceof SyntaxError) {
        message.error('JSON 解析失败，请检查文件格式（参考导出按钮获取模板）')
      } else if ((err as { response?: { status?: number } }).response?.status === 413) {
        message.error('文件过大，超出服务器限制，请拆分后分批导入')
      } else {
        message.error('导入失败，请稍后重试')
      }
    } finally {
      setImporting(false)
      // 重置 file input，允许重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [invalidate])

  /* ============================================================
   *  表格列定义
   *  ============================================================ */
  const columns: ColumnsType<TavernCharacter> = [
    { title: '角色名', dataIndex: 'name', key: 'name', width: 140 },
    {
      title: '类型',
      dataIndex: 'cardType',
      key: 'cardType',
      width: 90,
      render: (v: string) => (
        <Tag>{CARD_TYPE_LABELS[v] || v || '角色卡'}</Tag>
      ),
    },
    {
      title: '创建者',
      dataIndex: ['creator', 'nickname'],
      key: 'creator',
      width: 120,
      render: (v: string) => v || '匿名',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 160,
      render: (tags: string[]) =>
        tags && tags.length > 0 ? (
          <Space size={2} wrap>
            {tags.slice(0, 3).map((t) => (
              <Tag key={t} style={{ margin: 0 }}>{t}</Tag>
            ))}
            {tags.length > 3 && <Tag>+{tags.length - 3}</Tag>}
          </Space>
        ) : (
          <span style={{ color: '#ccc' }}>-</span>
        ),
    },
    { title: '对话', dataIndex: 'chatCount', key: 'chatCount', width: 70, align: 'right' },
    { title: '点赞', dataIndex: 'likeCount', key: 'likeCount', width: 70, align: 'right' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      fixed: 'right',
      render: (_: unknown, record: TavernCharacter) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Popconfirm title="确认批准？" onConfirm={() => approveMutation.mutate(record.id)}>
                <Button type="link" size="small" icon={<CheckCircleOutlined />}>批准</Button>
              </Popconfirm>
              <Popconfirm title="确认拒绝？" onConfirm={() => rejectMutation.mutate(record.id)}>
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />}>拒绝</Button>
              </Popconfirm>
            </>
          )}
          {record.status !== 'BANNED' && (
            <Popconfirm title="确认封禁？" onConfirm={() => banMutation.mutate(record.id)}>
              <Button type="link" size="small" danger icon={<StopOutlined />}>封禁</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  /* ============================================================
   *  渲染
   *  ============================================================ */
  return (
    <div>
      <PageHeader
        title="角色管理"
        extra={
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={handleCreate}>
              创建卡片
            </Button>
            <Button icon={<ImportOutlined />} loading={importing} onClick={handleImport}>
              导入JSON
            </Button>
            <Button icon={<ExportOutlined />} loading={exporting} onClick={handleExport}>
              导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={invalidate}>
              刷新
            </Button>
          </Space>
        }
      />

      {/* ── 筛选栏 ── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col>
            <Input.Search
              placeholder="搜索角色名"
              allowClear
              style={{ width: 220 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => setPage(1)}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Col>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 130 }}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              options={STATUS_OPTIONS}
            />
          </Col>
          <Col>
            <Select
              placeholder="卡片类型"
              allowClear
              style={{ width: 130 }}
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1) }}
              options={CARD_TYPE_OPTIONS}
            />
          </Col>
          {selectedRowKeys.length > 0 && (
            <Col>
              <Space>
                <Button size="small" onClick={handleBatchApprove}>
                  批量批准 ({selectedRowKeys.length})
                </Button>
              </Space>
            </Col>
          )}
        </Row>
      </Card>

      {/* ── 错误态 ── */}
      {isError && (
        <Alert
          type="error" showIcon
          message="角色列表加载失败"
          action={<Button size="small" icon={<ReloadOutlined />} onClick={invalidate}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── 表格 ── */}
      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table<TavernCharacter>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 1200 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 张卡片`,
          }}
          locale={{ emptyText: <Empty description="暂无角色卡片" /> }}
        />
      )}

      {/* ── 详情抽屉 ── */}
      <Drawer
        title="角色详情"
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailChar(null) }}
        width={480}
        extra={<Button type="text" onClick={() => setDetailOpen(false)}>关闭</Button>}
      >
        {detailChar ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="卡片名称">{detailChar.name}</Descriptions.Item>
            <Descriptions.Item label="卡片类型">
              <Tag>{CARD_TYPE_LABELS[detailChar.cardType ?? ''] ?? detailChar.cardType ?? '角色卡'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_CONFIG[detailChar.status]?.color}>
                {STATUS_CONFIG[detailChar.status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建者">{detailChar.creator?.nickname || '匿名'}</Descriptions.Item>
            <Descriptions.Item label="卡片简介">
              <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {detailChar.description || '-'}
              </Typography.Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="卡片提示词">
              <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                {detailChar.prompt || '-'}
              </Typography.Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="标签">
              {detailChar.tags && detailChar.tags.length > 0
                ? detailChar.tags.map((t: string) => <Tag key={t} style={{ margin: 2 }}>{t}</Tag>)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="头像 URL">
              {detailChar.avatar ? (
                <Typography.Text copyable style={{ fontSize: 12 }}>{detailChar.avatar}</Typography.Text>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="对话数">{detailChar.chatCount}</Descriptions.Item>
            <Descriptions.Item label="点赞数">{detailChar.likeCount}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(detailChar.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="无数据" />
        )}
      </Drawer>

      {/* ── 编辑/创建模态框 ── */}
      <Modal
        title={editingId ? '编辑卡片' : '创建卡片'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleFormSubmit}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={formData}>
          <Form.Item name="name" label="卡片名称" rules={[{ required: true, message: '请输入卡片名称' }]}>
            <Input placeholder="卡片名称" />
          </Form.Item>
          <Form.Item name="cardType" label="卡片类型">
            <Select options={CARD_TYPE_OPTIONS.filter((o) => o.value !== '')} />
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
      {/* ── 隐藏文件输入：JSON 导入 ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => { void handleFileChange(e) }}
      />
    </div>
  )
}

export default TavernCharacters
