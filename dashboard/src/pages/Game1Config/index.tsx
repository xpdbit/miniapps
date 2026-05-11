import { useState } from 'react'
import { Table, Button, Modal, Input, message, Space, Tag } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ReloadOutlined, EditOutlined, LockOutlined } from '@ant-design/icons'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { game1ConfigApi, type Game1ConfigEntry } from '@/services/game1'
import dayjs from 'dayjs'

const Game1Config = () => {
  const queryClient = useQueryClient()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const { data: keys, isLoading: keysLoading } = useQuery({
    queryKey: ['game1-config-keys'],
    queryFn: () => game1ConfigApi.listKeys(),
  })

  const configsQuery = useQuery({
    queryKey: ['game1-config-values', keys],
    queryFn: async (): Promise<Game1ConfigEntry[]> => {
      const keyList = keys?.data
      if (!keyList || keyList.length === 0) return []
      const results = await Promise.all(
        keyList.map(async (key: string) => {
          try {
            const res = await game1ConfigApi.getValue(key)
            return res.data  // ApiResponse<Game1Config> → Game1Config
          } catch {
            return { key, value: '(获取失败)', updatedAt: '' }
          }
        }),
      )
      return results
    },
    enabled: !!keys?.data && keys.data.length > 0,
  })

  const handleEdit = (record: Game1ConfigEntry) => {
    setEditingKey(record.key)
    setEditingValue(record.value)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editingKey) return
    try {
      await game1ConfigApi.updateConfig(editingKey, editingValue)
      message.success('配置更新成功')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['game1-config-values'] })
    } catch {
      message.error('更新失败')
    }
  }

  const columns = [
    {
      title: '配置项',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Space>
          <LockOutlined style={{ color: '#999' }} />
          <code style={{ fontWeight: 600 }}>{key}</code>
        </Space>
      ),
    },
    {
      title: '当前值',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (val: string) => (
        <Tag color="blue" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {val}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Game1ConfigEntry) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Game1 游戏配置"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['game1-config'] })}>
            刷新
          </Button>
        }
      />

      {keysLoading || configsQuery.isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table
          columns={columns}
          dataSource={configsQuery.data ?? []}
          rowKey="key"
          scroll={{ x: 700 }}
          pagination={false}
        />
      )}

      <Modal
        title={`编辑配置: ${editingKey}`}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8, color: '#666' }}>
          配置项: <code>{editingKey}</code>
        </div>
        <Input.TextArea
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          rows={4}
          placeholder="请输入配置值"
        />
      </Modal>
    </div>
  )
}

export default Game1Config
