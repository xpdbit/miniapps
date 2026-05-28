import { useState, useCallback } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Popconfirm,
  Tag,
  message,
  Space,
  Card,
  Typography,
  Tabs,
} from 'antd'
import { PlusOutlined, LinkOutlined, RobotOutlined, CloudServerOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import { useResponsiveWidth } from '@/hooks/useResponsiveWidth'
import { MODAL_WIDTH } from '@/constants/layout'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { aiManagerApi } from '@/services/aiManagerApi'
import type { AiProvider } from '@/services/aiManagerApi'
import { PageSkeleton } from '@/components/PageSkeleton'
import TavernModelManager from '@/pages/Tavern/TavernModelManager'
import dayjs from 'dayjs'

type FormValues = Pick<AiProvider, 'name' | 'provider' | 'apiKey' | 'baseUrl' | 'isActive'> & {
  qpsLimit?: number
  hourlyLimit?: number
  dailyLimit?: number
  weight?: number
  fallbackProviders?: string[]
}

const AiManager = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'models' ? 'models' : 'providers'
  const setActiveTab = useCallback((key: string) => {
    setSearchParams(key === 'models' ? { tab: 'models' } : {}, { replace: true })
  }, [setSearchParams])
  const [modalOpen, setModalOpen] = useState(false)
  const modalWidth = useResponsiveWidth(MODAL_WIDTH)
  const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<FormValues>()

  const { data: providers, isLoading } = useQuery({
    queryKey: ['ai-manager'],
    queryFn: async () => {
      const res = await aiManagerApi.list()
      return res.data.data.providers
    },
  })

  const handleAdd = () => {
    setEditingProvider(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true, weight: 1 })
    setModalOpen(true)
  }

  const handleEdit = (record: AiProvider) => {
    setEditingProvider(record)
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      apiKey: record.apiKey ?? '',
      baseUrl: record.baseUrl ?? '',
      isActive: record.isActive,
      qpsLimit: record.config?.qpsLimit,
      hourlyLimit: record.config?.hourlyLimit,
      dailyLimit: record.config?.dailyLimit,
      weight: record.config?.weight ?? 1,
      fallbackProviders: record.config?.fallbackProviders,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const payload = {
        name: values.name,
        provider: values.provider,
        apiKey: values.apiKey || undefined,
        baseUrl: values.baseUrl || undefined,
        isActive: values.isActive,
        config: {
          qpsLimit: values.qpsLimit,
          hourlyLimit: values.hourlyLimit,
          dailyLimit: values.dailyLimit,
          weight: values.weight,
          ...(values.fallbackProviders?.length
            ? { fallbackProviders: values.fallbackProviders }
            : {}),
        },
      }

      if (editingProvider) {
        await aiManagerApi.update(editingProvider.provider, payload)
        message.success('更新成功')
      } else {
        await aiManagerApi.create(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditingProvider(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['ai-manager'] })
    } catch {
      // validation error or API error — Ant Design form handles validation UI
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (provider: string) => {
    try {
      await aiManagerApi.delete(provider)
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['ai-manager'] })
    } catch {
      // error handled by apiClient interceptor
    }
  }

  const handleTestConnection = async (provider: string) => {
    setTestingId(provider)
    try {
      const res = await aiManagerApi.testConnection(provider)
      const testData = res.data.data
      if (testData.reachable) {
        message.success(testData.message || '连接成功')
      } else {
        message.warning(testData.message || '连接失败')
      }
    } catch {
      message.error('连接测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const handleSyncDefaults = async () => {
    try {
      const res = await aiManagerApi.syncDefaults()
      const results = res.data.data.results
      const created = results.filter(r => r.action === 'created').length
      const updated = results.filter(r => r.action === 'updated').length
      message.success(`同步完成：创建 ${created} 个，更新 ${updated} 个`)
      queryClient.invalidateQueries({ queryKey: ['ai-manager'] })
    } catch {
      // error handled by apiClient interceptor
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AiProvider) => (
        <Space>
          <RobotOutlined />
          <span>{name}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ({record.provider})
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: 'QPS 限制',
      key: 'qpsLimit',
      render: (_: unknown, record: AiProvider) =>
        record.config?.qpsLimit ?? '-',
    },
    {
      title: '权重',
      key: 'weight',
      render: (_: unknown, record: AiProvider) =>
        record.config?.weight ?? 1,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AiProvider) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            loading={testingId === record.provider}
            onClick={() => handleTestConnection(record.provider)}
          >
            测试连接
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除此服务商吗？"
            onConfirm={() => handleDelete(record.provider)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
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
      <PageHeader
        title="AI 管理"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['ai-manager'] })}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'providers',
            label: <span><RobotOutlined /> 服务商管理</span>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Button onClick={handleSyncDefaults}>同步默认服务商</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                      新增服务商
                    </Button>
                  </Space>
                </div>

                {isLoading ? (
                  <PageSkeleton type="table" />
                ) : (
                  <Table
                    dataSource={providers}
                    columns={columns}
                    rowKey="id"
                    scroll={{ x: 900 }}
                    pagination={{ pageSize: 10 }}
                  />
                )}
              </>
            ),
          },
          {
            key: 'models',
            label: <span><CloudServerOutlined /> 模型管理</span>,
            children: <TavernModelManager />,
          },
        ]}
      />

      <Modal
        title={editingProvider ? '编辑服务商' : '新增服务商'}
        open={modalOpen}
        width={modalWidth}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false)
          setEditingProvider(null)
          form.resetFields()
        }}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入服务商名称' }]}
          >
            <Input placeholder="例如：阿里通义千问" />
          </Form.Item>
          <Form.Item
            name="provider"
            label="Provider 标识"
            rules={[{ required: true, message: '请输入 provider 标识' }]}
          >
            <Input placeholder="例如：qwen" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="输入 API Key（留空不修改）" autoComplete="off" />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL">
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item name="isActive" label="启用状态" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Card title="负载均衡配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="qpsLimit" label="QPS 上限">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="每秒请求数限制" />
            </Form.Item>
            <Form.Item name="hourlyLimit" label="每小时上限">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="每小时请求数限制" />
            </Form.Item>
            <Form.Item name="dailyLimit" label="每日上限">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="每日请求数限制" />
            </Form.Item>
            <Form.Item
              name="weight"
              label="权重"
              rules={[{ required: true, message: '请输入权重' }]}
            >
              <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="负载均衡权重" />
            </Form.Item>
            <Form.Item name="fallbackProviders" label="回退提供商">
              <Select
                mode="tags"
                placeholder="输入 provider 标识后回车添加"
                open={false}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Card>
        </Form>
      </Modal>
    </div>
  )
}

export default AiManager
