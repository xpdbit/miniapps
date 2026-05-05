import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Popconfirm,
  Tag,
  message,
  Space,
} from 'antd'
import useMobile from '@/hooks/useMobile'
import { PlusOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/services/projectApi'
import type { Project } from '@/types'
import dayjs from 'dayjs'

const { Title } = Typography

const Projects = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const isMobile = useMobile()
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<Pick<Project, 'name' | 'apiBaseUrl' | 'description'>>()

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await projectApi.list()
      return res.data.data.projects
    },
  })

  const handleAdd = () => {
    setEditingProject(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Project) => {
    setEditingProject(record)
    form.setFieldsValue({
      name: record.name,
      apiBaseUrl: record.apiBaseUrl,
      description: record.description ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        name: values.name,
        apiBaseUrl: values.apiBaseUrl,
        ...(values.description ? { description: values.description } : {}),
      }
      if (editingProject) {
        await projectApi.update(editingProject.id, payload)
        message.success('更新成功')
      } else {
        await projectApi.create(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditingProject(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch {
      // validation error or API error — Ant Design form handles validation UI
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await projectApi.delete(id)
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch {
      // error handled by apiClient interceptor
    }
  }

  const handleTestConnection = async (id: number) => {
    setTestingId(id)
    try {
      const res = await projectApi.testConnection(id)
      const responseData = res.data
      if (responseData.success) {
        message.success(responseData.message || '连接成功')
      } else {
        message.warning(responseData.message || '连接失败')
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch {
      message.error('连接测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'API 地址',
      dataIndex: 'apiBaseUrl',
      key: 'apiBaseUrl',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '正常' : '异常'}
        </Tag>
      ),
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
      render: (_: unknown, record: Project) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            loading={testingId === record.id}
            onClick={() => handleTestConnection(record.id)}
          >
            测试连接
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除此项目吗？"
            onConfirm={() => handleDelete(record.id)}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>项目管理</Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增项目
          </Button>
        </Space>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 700 }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingProject ? '编辑项目' : '新增项目'}
        open={modalOpen}
        width={isMobile ? '100%' : 520}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false)
          setEditingProject(null)
          form.resetFields()
        }}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item
            name="apiBaseUrl"
            label="API 地址"
            rules={[{ required: true, message: '请输入 API 地址' }]}
          >
            <Input placeholder="https://api.example.com" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入项目描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Projects
