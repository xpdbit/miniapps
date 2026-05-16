/**
 * Themes 页面 — 主题管理
 *
 * 拆分为子组件：
 * - ThemeCard: 主题卡片
 * - ThemeFormDrawer: 编辑/新建抽屉
 * - 常量和配置由 ThemeFormDrawer 导出
 */
import { useState, useRef, useCallback, useMemo } from 'react'
import {
  Button,
  Row,
  Modal,
  message,
  Empty,
  Alert,
  Form,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { themesAPI, themeRenderAPI } from '@/services/ftg-api'
import type { Theme, ThemeConfig } from '@/types'
import { PageSkeleton } from '@/components/PageSkeleton'
import ThemeCard from './ThemeCard'
import ThemeFormDrawer, {
  DEFAULT_TEMPLATE_MARKUP,
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_JSON,
  PREVIEW_MOCK_DATA,
} from './ThemeFormDrawer'

const Themes = () => {
  const queryClient = useQueryClient()

  // ── 状态 ──
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  // 模板 TextArea 引用
  const textareaRef = useRef<{
    resizableTextArea?: {
      textArea: HTMLTextAreaElement
    }
  }>(null)

  // ── 查询 ──
  const { data: themes, isLoading, isError, error } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const res = await themesAPI.list()
      const raw = res.data.data?.themes ?? res.data.data
      return Array.isArray(raw) ? raw : []
    },
  })

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
        setTemplateMarkup((prev) => prev + variable)
        return
      }
      const start = textAreaEl.selectionStart
      const end = textAreaEl.selectionEnd
      const newVal = templateMarkup.slice(0, start) + variable + templateMarkup.slice(end)
      setTemplateMarkup(newVal)
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
    let config: ThemeConfig | null = null
    if (oldConfigJson.trim()) {
      config = validateOldConfig(oldConfigJson)
      if (!config) {
        message.error('旧版配置 JSON 格式有误，请修正后重试')
        return
      }
    }

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

    try {
      await themesAPI.update(current.themeId, { sortOrder: previous.sortOrder })
      await themesAPI.update(previous.themeId, { sortOrder: current.sortOrder })
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

    try {
      await themesAPI.update(current.themeId, { sortOrder: next.sortOrder })
      await themesAPI.update(next.themeId, { sortOrder: current.sortOrder })
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

  // ── 渲染 ──
  return (
    <div>
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
          {sortedThemes.map((theme, index) => {
            const isFirst = index === 0
            const isLast = index === sortedThemes.length - 1
            return (
              <ThemeCard
                key={theme.id}
                theme={theme}
                index={index}
                isFirst={isFirst}
                isLast={isLast}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onEdit={handleEdit}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
              />
            )
          })}
        </Row>
      )}

      {/* 编辑抽屉 */}
      <ThemeFormDrawer
        open={drawerOpen}
        editingTheme={editingTheme}
        submitting={submitting}
        templateMarkup={templateMarkup}
        selectedClasses={selectedClasses}
        oldConfigJson={oldConfigJson}
        oldConfigError={oldConfigError}
        form={form}
        textareaRef={textareaRef}
        previewLoading={previewLoading}
        onTemplateChange={setTemplateMarkup}
        onClassesChange={setSelectedClasses}
        onOldConfigChange={handleOldConfigChange}
        onInsertVariable={handleInsertVariable}
        onPreview={handlePreview}
        onSubmit={handleSubmit}
        onClose={() => {
          setDrawerOpen(false)
          setEditingTheme(null)
          form.resetFields()
          setOldConfigError(null)
        }}
      />

      {/* 预览弹窗 */}
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
