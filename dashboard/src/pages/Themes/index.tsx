import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Typography,
  Button,
  Card,
  Row,
  Col,
  Tag,
  Space,
  Drawer,
  Form,
  Input,
  Select,
  Modal,
  Popconfirm,
  message,
  Empty,
  Alert,
  Divider,
  Collapse,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { useResponsiveWidth } from '@/hooks/useResponsiveWidth'
import { DRAWER_WIDTH_WIDE } from '@/constants/layout'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { themesAPI, themeClassesAPI, themeRenderAPI } from '@/services/ftg-api'
import type { Theme, ThemeConfig, ThemeClassItem } from '@/types'
import { PageSkeleton } from '@/components/PageSkeleton'

const { Text } = Typography
const { TextArea } = Input

// ───────────────────── 常量 ─────────────────────

const DEFAULT_TEMPLATE_MARKUP = `<div class="item-card">
  <div class="item-icon">
    <img src="{{foodImage}}" class="icon-base">
  </div>
  <div class="item-info">
    <div class="item-name">{{foodName}}</div>
    <div class="item-desc">{{foodDescription}}</div>
    <div class="item-calories">{{calories}} 大卡</div>
  </div>
</div>`

const DEFAULT_CONFIG: ThemeConfig = {
  frame: {
    frameImageId: '',
    borderWidth: 4,
    borderRadius: 12,
    overlayColor: '#000000',
    overlayOpacity: 0.25,
  },
  compose: {
    imageScale: 1,
    offsetX: 0,
    offsetY: 0,
    textTemplate: '{{foodName}}',
    textColor: '#ffffff',
    fontSize: 32,
    textX: 0,
    textY: 0,
  },
}

const DEFAULT_CONFIG_JSON = JSON.stringify(DEFAULT_CONFIG, null, 2)

const VARIABLE_LIST = [
  { label: '食物名称', value: '{{foodName}}' },
  { label: '食物描述', value: '{{foodDescription}}' },
  { label: '卡路里', value: '{{calories}}' },
  { label: '食物图片', value: '{{foodImage}}' },
] as const

const PREVIEW_MOCK_DATA: Record<string, string> = {
  foodName: '香煎三文鱼',
  foodDescription: '外酥里嫩，搭配柠檬黄油酱汁',
  calories: '320',
  foodImage: 'https://via.placeholder.com/150',
}

// ───────────────────── 主页面 ─────────────────────

const Themes = () => {
  const queryClient = useQueryClient()

  // ── 状态 ──
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerWidth = useResponsiveWidth(DRAWER_WIDTH_WIDE)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 模板编辑器
  const [templateMarkup, setTemplateMarkup] = useState(DEFAULT_TEMPLATE_MARKUP)
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])

  // 旧版配置
  const [oldConfigJson, setOldConfigJson] = useState(DEFAULT_CONFIG_JSON)
  const [oldConfigError, setOldConfigError] = useState<string | null>(null)

  // 预览
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const [form] = Form.useForm<{
    name: string
    description: string
    shortName: string
    gameName: string
    previewImageUrl: string
    status: 'active' | 'inactive'
  }>()

  // 模板 TextArea 引用（用于光标插入）
  const textareaRef = useRef<{
    resizableTextArea?: {
      textArea: HTMLTextAreaElement
    }
  }>(null)

  // ── 查询主题列表 ──
  const { data: themes, isLoading, isError, error } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const res = await themesAPI.list()
      const raw = res.data.data?.themes ?? res.data.data
      return Array.isArray(raw) ? raw : []
    },
  })

  // ── 查询主题类（抽屉打开时） ──
  const { data: classList } = useQuery({
    queryKey: ['theme-classes'],
    queryFn: async () => {
      const res = await themeClassesAPI.list()
      const raw = res.data.data?.classes ?? res.data.data ?? []
      return Array.isArray(raw) ? raw : []
    },
    enabled: drawerOpen,
  })

  const classOptions = useMemo(
    () =>
      (classList ?? []).map((c: ThemeClassItem) => ({
        label: c.name,
        value: c.classId,
      })),
    [classList],
  )

  // 按 sortOrder 排序
  const sortedThemes = useMemo(() => {
    if (!Array.isArray(themes)) return []
    return [...themes].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [themes])

  // ── 旧版配置校验 ──
  const validateOldConfig = (value: string): ThemeConfig | null => {
    try {
      const parsed = JSON.parse(value)
      if (!parsed.frame || !parsed.compose) {
        setOldConfigError('缺少 frame 或 compose 字段')
        return null
      }
      setOldConfigError(null)
      return parsed as ThemeConfig
    } catch (e) {
      setOldConfigError((e as Error).message)
      return null
    }
  }

  const handleOldConfigChange = (value: string) => {
    setOldConfigJson(value)
    if (value.trim()) {
      validateOldConfig(value)
    } else {
      setOldConfigError(null)
    }
  }

  // ── 变量插入 ──
  const handleInsertVariable = useCallback(
    (variable: string) => {
      const textAreaEl = textareaRef.current?.resizableTextArea?.textArea
      if (!textAreaEl) {
        // fallback: append to end
        setTemplateMarkup((prev) => prev + variable)
        return
      }

      const start = textAreaEl.selectionStart
      const end = textAreaEl.selectionEnd
      const newVal = templateMarkup.slice(0, start) + variable + templateMarkup.slice(end)
      setTemplateMarkup(newVal)

      // 恢复光标位置
      requestAnimationFrame(() => {
        textAreaEl.focus()
        const pos = start + variable.length
        textAreaEl.selectionStart = pos
        textAreaEl.selectionEnd = pos
      })
    },
    [templateMarkup],
  )

  // ── 打开抽屉 ──
  const handleAdd = () => {
    setEditingTheme(null)
    form.resetFields()
    setTemplateMarkup(DEFAULT_TEMPLATE_MARKUP)
    setSelectedClasses([])
    setOldConfigJson(DEFAULT_CONFIG_JSON)
    setOldConfigError(null)
    setDrawerOpen(true)
  }

  const handleEdit = (theme: Theme) => {
    setEditingTheme(theme)
    form.setFieldsValue({
      name: theme.name,
      description: theme.description ?? '',
      shortName: theme.shortName ?? '',
      gameName: theme.gameName,
      previewImageUrl: theme.previewImageUrl ?? '',
      status: theme.status,
    })
    setTemplateMarkup(theme.templateMarkup ?? DEFAULT_TEMPLATE_MARKUP)
    setSelectedClasses(theme.cssClasses ?? [])
    setOldConfigJson(JSON.stringify(theme.config, null, 2))
    setOldConfigError(null)
    setDrawerOpen(true)
  }

  // ── 保存 ──
  const handleSubmit = async () => {
    // 1) 校验旧版 JSON
    let config: ThemeConfig | null = null
    if (oldConfigJson.trim()) {
      config = validateOldConfig(oldConfigJson)
      if (!config) {
        message.error('旧版配置 JSON 格式有误，请修正后重试')
        return
      }
    }

    // 2) 校验表单
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || null,
        shortName: values.shortName || null,
        gameName: values.gameName,
        previewImageUrl: values.previewImageUrl || null,
        status: values.status,
        templateMarkup: templateMarkup || null,
        cssClasses: selectedClasses,
        config: config ?? DEFAULT_CONFIG,
      }

      if (editingTheme) {
        await themesAPI.update(editingTheme.themeId, payload)
        message.success('主题更新成功')
      } else {
        await themesAPI.create(payload)
        message.success('主题创建成功')
      }

      setDrawerOpen(false)
      setEditingTheme(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── 删除 ──
  const handleDelete = async (theme: Theme) => {
    try {
      await themesAPI.delete(theme.themeId)
      message.success('主题已删除')
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    } catch {
      // 拦截器已处理
    }
  }

  // ── 启用/禁用 ──
  const handleToggleStatus = async (theme: Theme) => {
    try {
      await themesAPI.toggleActive(theme.themeId)
      message.success(theme.status === 'active' ? '主题已禁用' : '主题已启用')
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    } catch {
      // 拦截器已处理
    }
  }

  // ── 排序 ──
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return
    const current = sortedThemes[index]
    const previous = sortedThemes[index - 1]
    if (!current || !previous) return
    const currentOrder = current.sortOrder
    const previousOrder = previous.sortOrder

    try {
      await themesAPI.update(current.themeId, { sortOrder: previousOrder })
      await themesAPI.update(previous.themeId, { sortOrder: currentOrder })
      message.success('排序已更新')
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    } catch {
      // 拦截器已处理
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index >= sortedThemes.length - 1) return
    const current = sortedThemes[index]
    const next = sortedThemes[index + 1]
    if (!current || !next) return
    const currentOrder = current.sortOrder
    const nextOrder = next.sortOrder

    try {
      await themesAPI.update(current.themeId, { sortOrder: nextOrder })
      await themesAPI.update(next.themeId, { sortOrder: currentOrder })
      message.success('排序已更新')
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    } catch {
      // 拦截器已处理
    }
  }

  // ── 预览 ──
  const handlePreview = async () => {
    const markup = templateMarkup.trim()
    if (!markup) {
      message.warning('请先编辑模板标记')
      return
    }

    setPreviewLoading(true)
    try {
      const res = await themeRenderAPI.renderPreview({
        templateMarkup: markup,
        cssClassIds: selectedClasses.length > 0 ? selectedClasses : undefined,
        data: PREVIEW_MOCK_DATA,
        mode: 'h5',
      })
      const responseData = res.data
      const htmlContent = responseData?.data?.html ?? responseData?.html ?? ''
      setPreviewHtml(htmlContent)
      setPreviewOpen(true)
    } catch {
      message.error('预览生成失败，请检查模板语法')
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── 抽屉关闭 ──
  const handleDrawerClose = () => {
    setDrawerOpen(false)
    setEditingTheme(null)
    form.resetFields()
    setOldConfigError(null)
  }

  // ── 渲染卡片 ──
  const renderThemeCard = (theme: Theme, index: number) => {
    const isFirst = index === 0
    const isLast = index === sortedThemes.length - 1

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={theme.id}>
        <Card
          hoverable
          style={{ borderRadius: 8, height: '100%' }}
          cover={
            <div
              style={{
                height: 180,
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
              }}
            >
              {theme.previewImageUrl ? (
                <img
                  alt={theme.name}
                  src={theme.previewImageUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://via.placeholder.com/320x180?text=加载失败'
                  }}
                />
              ) : (
                <Text type="secondary" style={{ fontSize: 14 }}>
                  暂无预览图
                </Text>
              )}
            </div>
          }
          actions={[
            <Tooltip title="上移" key="up">
              <Button
                type="text"
                size="small"
                icon={<ArrowUpOutlined />}
                disabled={isFirst}
                onClick={() => handleMoveUp(index)}
              />
            </Tooltip>,
            <Tooltip title="下移" key="down">
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={isLast}
                onClick={() => handleMoveDown(index)}
              />
            </Tooltip>,
            <Tooltip title="编辑" key="edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(theme)}
              />
            </Tooltip>,
            <Tooltip title={theme.status === 'active' ? '禁用' : '启用'} key="toggle">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleToggleStatus(theme)}
              />
            </Tooltip>,
            <Popconfirm
              title="确认删除"
              description={`确定要删除主题「${theme.name}」吗？如果该主题被食物记录引用，将无法删除。`}
              onConfirm={() => handleDelete(theme)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              key="delete"
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>,
          ]}
        >
          <Card.Meta
            title={
              <Space align="center" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong ellipsis style={{ maxWidth: 140 }} title={theme.name}>
                  {theme.name}
                </Text>
                <Tag
                  color={theme.status === 'active' ? 'green' : 'default'}
                  style={{ flexShrink: 0, margin: 0 }}
                >
                  {theme.status === 'active' ? '启用' : '禁用'}
                </Tag>
              </Space>
            }
            description={
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Text type="secondary" ellipsis style={{ fontSize: 13 }}>
                  {theme.gameName}
                </Text>
                <Space size={4} wrap>
                  <Tag color="blue" style={{ fontSize: 11, lineHeight: '18px' }}>
                    排序: {theme.sortOrder}
                  </Tag>
                  <Tag color="purple" style={{ fontSize: 11, lineHeight: '18px' }}>
                    使用: {theme.usageCount}
                  </Tag>
                </Space>
              </Space>
            }
          />
        </Card>
      </Col>
    )
  }

  // ── 渲染 ──
  return (
    <div>
      {/* 页面头部 */}
      <PageHeader
        title="主题管理"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['themes'] })}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建主题</Button>}
      />

      {/* 加载态 */}
      {isLoading && <PageSkeleton type="cards" />}

      {/* 错误态 */}
      {isError && !isLoading && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={(error as Error)?.message || '无法获取主题列表，请稍后重试。'}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['themes'] })}
            >
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 空态 */}
      {!isLoading && !isError && sortedThemes.length === 0 && (
        <Empty style={{ padding: 80 }} description="暂无主题">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建第一个主题
          </Button>
        </Empty>
      )}

      {/* 卡片网格 */}
      {!isLoading && !isError && sortedThemes.length > 0 && (
        <Row gutter={[16, 16]}>
          {sortedThemes.map((theme, index) => renderThemeCard(theme, index))}
        </Row>
      )}

      {/* ── 编辑抽屉 ── */}
      <Drawer
        title={editingTheme ? '编辑主题' : '新建主题'}
        open={drawerOpen}
        onClose={handleDrawerClose}
        width={drawerWidth}
        extra={
          <Space>
            <Button onClick={handleDrawerClose}>取消</Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewLoading}
            >
              预览
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {editingTheme ? '保存' : '创建'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 'active' }}
        >
          {/* ── 基本信息 ── */}
          <Divider orientation="left" orientationMargin={0}>
            基本信息
          </Divider>

          <Form.Item
            name="name"
            label="主题名称"
            rules={[{ required: true, message: '请输入主题名称' }]}
          >
            <Input placeholder="例如：春日樱花" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea
              rows={2}
              placeholder="主题描述（可选）"
            />
          </Form.Item>

          <Form.Item
            name="shortName"
            label="短名称（URL 友好）"
            rules={[{ required: true, message: '请输入短名称' }]}
          >
            <Input
              placeholder="例如：spring-sakura"
            />
          </Form.Item>

          <Form.Item
            name="gameName"
            label="关联游戏"
            rules={[{ required: true, message: '请输入关联游戏名称' }]}
          >
            <Input placeholder="例如：原神" />
          </Form.Item>

          <Form.Item name="previewImageUrl" label="预览图 URL">
            <Input placeholder="https://example.com/preview.png（可选）" />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
          </Form.Item>

          {editingTheme && (
            <Form.Item label="使用次数">
              <Tag color="purple" style={{ fontSize: 13 }}>
                {editingTheme.usageCount}
              </Tag>
            </Form.Item>
          )}

          {/* ── 模板编辑 ── */}
          <Divider orientation="left" orientationMargin={0}>
            模板编辑
          </Divider>

          <div style={{ marginBottom: 12 }}>
            <Space wrap>
              <Text type="secondary" style={{ fontSize: 13 }}>
                插入变量：
              </Text>
              {VARIABLE_LIST.map((v) => (
                <Button
                  key={v.value}
                  size="small"
                  type="dashed"
                  onClick={() => handleInsertVariable(v.value)}
                  style={{ fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                >
                  {v.value}
                </Button>
              ))}
            </Space>
          </div>

          <TextArea
            ref={textareaRef as React.Ref<any>}
            value={templateMarkup}
            onChange={(e) => setTemplateMarkup(e.target.value)}
            rows={14}
            style={{
              fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.6,
            }}
            placeholder="请输入 HTML 模板标记"
          />

          <div style={{ marginTop: 16 }}>
            <Form.Item label="关联 CSS 类">
              <Select
                mode="multiple"
                placeholder="选择与此主题关联的 CSS 类"
                options={classOptions}
                value={selectedClasses}
                onChange={setSelectedClasses}
                allowClear
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>

          {/* ── 旧版配置 ── */}
          <Divider orientation="left" orientationMargin={0}>
            <Text type="secondary" style={{ fontSize: 13 }}>旧版配置（兼容）</Text>
          </Divider>

          <Collapse
            items={[
              {
                key: 'old-config',
                label: '展开编辑旧版 JSON 配置',
                children: (
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          编辑主题的 frame 和 compose 配置
                        </Text>
                        {oldConfigJson.trim() && (
                          <Tag
                            color={oldConfigError ? 'red' : 'green'}
                            style={{ fontSize: 11 }}
                          >
                            {oldConfigError ? '格式错误' : '格式正确'}
                          </Tag>
                        )}
                      </Space>
                    </div>

                    <TextArea
                      value={oldConfigJson}
                      onChange={(e) => handleOldConfigChange(e.target.value)}
                      rows={10}
                      style={{
                        fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                      placeholder="请输入有效的 JSON 配置"
                    />

                    {oldConfigError && (
                      <Alert
                        type="error"
                        showIcon
                        message="JSON 校验失败"
                        description={oldConfigError}
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>

      {/* ── 预览弹窗 ── */}
      <Modal
        title="模板预览"
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false)
          setPreviewHtml('')
        }}
        width={480}
        footer={null}
        destroyOnClose
      >
        {previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            style={{
              width: '100%',
              height: 600,
              border: 'none',
              borderRadius: 4,
            }}
            title="模板预览"
            sandbox="allow-scripts"
          />
        ) : (
          <Empty description="暂无预览内容" />
        )}
      </Modal>
    </div>
  )
}

export default Themes
