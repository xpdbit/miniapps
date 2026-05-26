import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  Tag,
  message,
  Space,
} from 'antd'
import useMobile from '@/hooks/useMobile'
import {
  PlusOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { keysApi } from '@/services/keysApi'
import PageHeader from '@/components/PageHeader'
import type { ApiKey, CreateKeyRequest, ApiKeyStatus } from '@/services/keysApi'
import { PageSkeleton } from '@/components/PageSkeleton'
import dayjs from 'dayjs'

const { Text } = Typography

// ─── 服务名称选项 ──────────────────────────────────────────
const SERVICE_OPTIONS = [
  { label: '微信小程序', value: 'wechat_mini_program' },
  { label: '支付宝小程序', value: 'alipay_mini_program' },
  { label: 'OpenAI', value: 'openai' },
  { label: '阿里云 OSS', value: 'aliyun_oss' },
  { label: '腾讯云 COS', value: 'tencent_cos' },
  { label: '短信服务 (SMS)', value: 'sms' },
  { label: '邮件服务', value: 'email' },
  { label: '支付网关', value: 'payment_gateway' },
  { label: '地图服务', value: 'map_service' },
]

const SERVICE_LABEL_MAP = Object.fromEntries(
  SERVICE_OPTIONS.map((o) => [o.value, o.label]),
)

// ─── 状态配置 ──────────────────────────────────────────────
const STATUS_CONFIG: Record<ApiKeyStatus, { label: string; color: string }> = {
  active: { label: '已配置', color: 'green' },
  inactive: { label: '未配置', color: 'gold' },
  expired: { label: '已过期', color: 'red' },
}

const getStatusConfig = (record: ApiKey) => {
  if (record.status === 'expired') return STATUS_CONFIG.expired
  if (record.active && record.status === 'active') return STATUS_CONFIG.active
  return STATUS_CONFIG.inactive
}

// ─── 掩码密钥 ──────────────────────────────────────────────
const MASKED_KEY = '****'

// ─── 组件 ──────────────────────────────────────────────────
const ApiKeys = () => {
  const queryClient = useQueryClient()

  // 新增弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const isMobile = useMobile()
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<CreateKeyRequest>()

  // ── 查询密钥列表 ──
  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await keysApi.list()
      return res.data.data.keys
    },
  })

  // ── 切换启用/禁用 Mutation ──
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await keysApi.update(id, { active })
    },
    onSuccess: () => {
      message.success('状态已更新')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 删除 Mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await keysApi.delete(id)
    },
    onSuccess: () => {
      message.success('密钥已删除')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      // apiClient 拦截器已处理
    },
  })

  // ── 新增弹窗 ──
  const handleOpenAdd = () => {
    form.resetFields()
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await keysApi.create(values)
      message.success('密钥已创建')
      setModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    } catch {
      // 表单校验或 API 错误
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    form.resetFields()
  }

  // ── 列表列定义 ──
  const columns = [
    {
      title: '服务名称',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (name: string) => SERVICE_LABEL_MAP[name] ?? name,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (_: unknown, record: ApiKey) => {
        const config = getStatusConfig(record)
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '密钥值',
      dataIndex: 'keyValue',
      key: 'keyValue',
      width: 120,
      render: () => (
        <Text code style={{ userSelect: 'none' }}>
          {MASKED_KEY}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '最近使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 170,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : <Text type="secondary">从未使用</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: ApiKey) => (
        <Space size="middle">
          <Switch
            checked={record.active}
            disabled={record.status === 'expired'}
            loading={toggleMutation.isPending}
            onChange={(checked) => {
              toggleMutation.mutate({ id: record.id, active: checked })
            }}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
          <Popconfirm
            title="确认删除"
            description={`确定要删除「${SERVICE_LABEL_MAP[record.serviceName] ?? record.serviceName}」的密钥吗？此操作不可恢复。`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* ── 页面头部 ── */}
      <PageHeader
        title="API 密钥管理"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>新增密钥</Button>}
      />

      {/* ── 密钥列表 ── */}
      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table
          dataSource={keys}
          columns={columns}
          rowKey="id"
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
          locale={{
            emptyText: '暂无 API 密钥数据',
          }}
        />
      )}

      {/* ── 新增密钥弹窗 ── */}
      <Modal
        title={
          <Space>
            <KeyOutlined />
            <span>新增 API 密钥</span>
          </Space>
        }
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={submitting}
        width={isMobile ? '100%' : 480}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="serviceName"
            label="服务名称"
            rules={[{ required: true, message: '请选择服务名称' }]}
          >
            <Select
              placeholder="选择需要配置密钥的服务"
              options={SERVICE_OPTIONS}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="keyValue"
            label="密钥值"
            rules={[
              { required: true, message: '请输入密钥值' },
              { min: 8, message: '密钥长度至少 8 位' },
            ]}
          >
            <Input.Password
              placeholder="输入 API 密钥"
              autoComplete="off"
              visibilityToggle
            />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            密钥将以加密方式存储，创建后无法再次查看明文。
          </Text>
        </Form>
      </Modal>
    </div>
  )
}

export default ApiKeys
