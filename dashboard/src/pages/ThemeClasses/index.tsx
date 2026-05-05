import { useState, useMemo } from 'react'
import {
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message,
  Empty,
  Spin,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { themeClassesAPI } from '@/services/ftg-api'
import type { ThemeClassItem } from '@/types'
import useMobile from '@/hooks/useMobile'

const { Title, Text } = Typography
const { TextArea } = Input

// ───────────────────── 表单类型 ─────────────────────
interface CssPropertyEntry {
  property: string
  value: string
}

interface ThemeClassFormValues {
  name: string
  category: 'official' | 'community'
  description?: string
  cssProperties: CssPropertyEntry[]
}

// ───────────────────── 主页面 ─────────────────────
const ThemeClasses = () => {
  const queryClient = useQueryClient()
  const isMobile = useMobile()

  // ── 状态 ──
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ThemeClassItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<ThemeClassFormValues>()

  // ── 查询列表 ──
  const { data: classes, isLoading, isError, error } = useQuery({
    queryKey: ['themeClasses'],
    queryFn: async () => {
      const res = await themeClassesAPI.list()
      const raw = res.data.data?.themeClasses ?? res.data.data
      return Array.isArray(raw) ? raw : []
    },
  })

  // ── 获取允许的 CSS 属性列表 ──
  const { data: allowedProperties } = useQuery({
    queryKey: ['themeClasses', 'allowedProperties'],
    queryFn: async () => {
      const res = await themeClassesAPI.getAllowedProperties()
      const raw = res.data?.data ?? res.data
      return Array.isArray(raw) ? raw : []
    },
    staleTime: 5 * 60 * 1000,
  })

  // ── 按 category 再按 name 排序 ──
  const sortedClasses = useMemo(() => {
    if (!Array.isArray(classes)) return []
    return [...classes].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category === 'official' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }, [classes])

  // ── 打开 Modal ──
  const handleAdd = () => {
    setEditingClass(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (item: ThemeClassItem) => {
    setEditingClass(item)
    const entries: CssPropertyEntry[] = Object.entries(item.cssProperties).map(
      ([property, value]) => ({ property, value }),
    )
    form.resetFields()
    form.setFieldsValue({
      name: item.name,
      category: item.category,
      description: item.description ?? undefined,
      cssProperties: entries,
    })
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingClass(null)
    form.resetFields()
  }

  // ── 保存 ──
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // 转换 cssProperties 数组 → Record
      const cssPropertiesRecord: Record<string, string> = {}
      if (Array.isArray(values.cssProperties)) {
        values.cssProperties.forEach(({ property, value }) => {
          if (property && value) {
            cssPropertiesRecord[property] = value
          }
        })
      }

      // 校验至少一个 CSS 属性
      if (Object.keys(cssPropertiesRecord).length === 0) {
        message.error('请至少添加一个 CSS 属性')
        return
      }

      setSubmitting(true)

      const payload = {
        name: values.name,
        category: values.category,
        description: values.description || undefined,
        cssProperties: cssPropertiesRecord,
      }

      if (editingClass) {
        await themeClassesAPI.update(editingClass.classId, payload as Record<string, unknown>)
        message.success('Class 更新成功')
      } else {
        await themeClassesAPI.create(payload as Record<string, unknown>)
        message.success('Class 创建成功')
      }

      handleModalClose()
      queryClient.invalidateQueries({ queryKey: ['themeClasses'] })
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return // 表单校验错误，Ant Design 已自动提示
      }
      // API 错误由拦截器处理
    } finally {
      setSubmitting(false)
    }
  }

  // ── 删除 ──
  const handleDelete = async (classId: string) => {
    try {
      await themeClassesAPI.delete(classId)
      message.success('Class 已删除')
      queryClient.invalidateQueries({ queryKey: ['themeClasses'] })
    } catch {
      // 拦截器已处理；如果被主题引用会显示错误信息
    }
  }

  // ── 启用/禁用 ──
  const handleToggleActive = async (item: ThemeClassItem, checked: boolean) => {
    try {
      await themeClassesAPI.update(item.classId, { isActive: checked } as Record<string, unknown>)
      message.success(checked ? 'Class 已启用' : 'Class 已禁用')
      queryClient.invalidateQueries({ queryKey: ['themeClasses'] })
    } catch {
      // 拦截器已处理
    }
  }

  // ── 表格列定义 ──
  const columns = [
    {
      title: 'ID',
      dataIndex: 'classId',
      key: 'classId',
      width: 100,
      ellipsis: true,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text
          code
          style={{ fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
        >
          {name}
        </Text>
      ),
    },
    {
      title: 'CSS 属性',
      dataIndex: 'cssProperties',
      key: 'cssProperties',
      render: (props: Record<string, string>) => {
        const entries = Object.entries(props)
        const shown = entries.slice(0, 3)
        const remaining = entries.length - 3
        return (
          <Space size={[4, 4]} wrap>
            {shown.map(([key, value]) => (
              <Tag
                key={key}
                style={{
                  fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
                  fontSize: 12,
                }}
              >
                {key}: {value}
              </Tag>
            ))}
            {remaining > 0 && <Tag>+{remaining}</Tag>}
          </Space>
        )
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: 'official' | 'community') => (
        <Tag color={category === 'official' ? 'blue' : 'green'}>
          {category === 'official' ? '官方' : '社区'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean, record: ThemeClassItem) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleActive(record, checked)}
          size="small"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (date ? new Date(date).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ThemeClassItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确认删除"
            description={`确定要删除 Class「${record.name}」吗？如果该 Class 被主题引用，将无法删除。`}
            onConfirm={() => handleDelete(record.classId)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── 渲染 ──
  return (
    <div>
      {/* 页面头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Class 管理
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['themeClasses'] })}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建 Class
          </Button>
        </Space>
      </div>

      {/* 加载态 */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">加载 Class 列表中…</Text>
          </div>
        </div>
      )}

      {/* 错误态 */}
      {isError && !isLoading && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={(error as Error)?.message || '无法获取 Class 列表，请稍后重试。'}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['themeClasses'] })}
            >
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 空态 */}
      {!isLoading && !isError && sortedClasses.length === 0 && (
        <Empty style={{ padding: 80 }} description="暂无 Class">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建第一个 Class
          </Button>
        </Empty>
      )}

      {/* 表格 */}
      {!isLoading && !isError && sortedClasses.length > 0 && (
        <Table
          dataSource={sortedClasses}
          columns={columns}
          rowKey="classId"
          scroll={{ x: isMobile ? 800 : undefined }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onRow={(record) => ({
            onClick: () => handleEdit(record),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {/* ── 创建/编辑弹窗 ── */}
      <Modal
        title={editingClass ? '编辑 Class' : '新建 Class'}
        open={modalOpen}
        onCancel={handleModalClose}
        width={isMobile ? '100%' : 640}
        footer={
          <Space>
            <Button onClick={handleModalClose}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {editingClass ? '保存' : '创建'}
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ category: 'official' as const, cssProperties: [] }}
        >
          {/* 名称 */}
          <Form.Item
            name="name"
            label="Class 名称"
            rules={[
              { required: true, message: '请输入 Class 名称' },
              { min: 2, message: '名称至少 2 个字符' },
              { max: 50, message: '名称最多 50 个字符' },
              {
                pattern: /^[a-zA-Z0-9-]+$/,
                message: '仅允许字母、数字和连字符',
              },
            ]}
          >
            <Input placeholder="例如：card-shadow" />
          </Form.Item>

          {/* 分类 */}
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select>
              <Select.Option value="official">官方</Select.Option>
              <Select.Option value="community">社区</Select.Option>
            </Select>
          </Form.Item>

          {/* 描述 */}
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选：描述这个 Class 的用途" />
          </Form.Item>

          {/* CSS 属性编辑器 */}
          <Form.Item label="CSS 属性" required>
            <Form.List name="cssProperties">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      align="baseline"
                      style={{ display: 'flex', marginBottom: 8 }}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, 'property']}
                        rules={[{ required: true, message: '请选择属性' }]}
                      >
                        <Select
                          placeholder="选择属性"
                          style={{ width: 180 }}
                          showSearch
                          optionFilterProp="label"
                        >
                          {(allowedProperties || []).map((prop: string) => (
                            <Select.Option key={prop} value={prop}>
                              <Text
                                code
                                style={{
                                  fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
                                  fontSize: 12,
                                }}
                              >
                                {prop}
                              </Text>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: '请输入属性值' }]}
                      >
                        <Input placeholder="属性值" style={{ width: 200 }} />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加属性
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          {/* 实时预览 */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const entries = getFieldValue('cssProperties') as CssPropertyEntry[] | undefined
              if (!entries || entries.length === 0) return null
              const inlineStyle: Record<string, string> = {}
              entries.forEach(({ property, value }) => {
                if (property && value) {
                  inlineStyle[property] = value
                }
              })
              if (Object.keys(inlineStyle).length === 0) return null
              return (
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                    实时预览：
                  </Text>
                  <div
                    style={{
                      padding: 16,
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      background: '#fafafa',
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...inlineStyle,
                    }}
                  >
                    预览元素
                  </div>
                </div>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ThemeClasses
