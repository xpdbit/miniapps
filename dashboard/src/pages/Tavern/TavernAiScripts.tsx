/**
 * TavernAiScripts — AI Script 管理页面
 * 三个标签页：事件注册表 / 游戏状态查看 / 事件日志
 */
import { useState } from 'react'
import {
  Card, Tabs, Table, Typography, Input, Tag, Spin,
  Empty, message,
} from 'antd'
import {
  CodeOutlined, DatabaseOutlined, HistoryOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'

const { Text } = Typography
const { TextArea } = Input

// ─── 事件注册表页面 ───────────────────────────────────────

function RegistryTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tavern-ai-script-registry'],
    queryFn: async () => {
      const res = await tavernAdminApi.getAiScriptRegistry()
      return unwrapTavernResponse<Array<{
        type: string
        description: string
        parameters: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>
      }>>(res.data)
    },
  })

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 48 }} />
  if (error) return <Text type="danger">加载失败: {(error as Error).message}</Text>
  if (!data) return <Empty description="无数据" />

  const columns = [
    { title: '事件类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '参数',
      dataIndex: 'parameters',
      key: 'parameters',
      render: (params: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>) => (
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
          {Object.entries(params).map(([key, def]) => (
            <li key={key}>
              <Text code>{key}</Text>
              <Text type="secondary"> ({def.type})</Text>
              {def.required && <Tag color="red" style={{ marginLeft: 4 }}>必填</Tag>}
              {def.enum && <Text type="secondary"> 可选值: {def.enum.join(', ')}</Text>}
              <br />
              <Text type="secondary">{def.description}</Text>
            </li>
          ))}
        </ul>
      ),
    },
  ]

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="type"
      pagination={false}
      size="small"
    />
  )
}

// ─── 游戏状态查看页面 ────────────────────────────────────

function StateTab() {
  const [saveId, setSaveId] = useState('')
  const [searchId, setSearchId] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['tavern-ai-script-state', searchId],
    queryFn: async () => {
      if (!searchId) return null
      const res = await tavernAdminApi.getAiScriptState(searchId)
      return unwrapTavernResponse<Record<string, unknown>>(res.data)
    },
    enabled: !!searchId,
  })

  const handleSearch = () => {
    if (!saveId.trim()) {
      void message.warning('请输入 Save ID')
      return
    }
    setSearchId(saveId.trim())
  }

  return (
    <div>
      <Input.Search
        placeholder="输入 Save ID 查询游戏状态"
        value={saveId}
        onChange={(e) => setSaveId(e.target.value)}
        onSearch={handleSearch}
        enterButton="查询"
        style={{ maxWidth: 400, marginBottom: 16 }}
      />
      {isLoading && <Spin style={{ display: 'block', marginTop: 24 }} />}
      {error && <Text type="danger">查询失败: {(error as Error).message}</Text>}
      {data && (
        <Card size="small" title="游戏状态">
          <TextArea
            rows={20}
            value={JSON.stringify(data, null, 2)}
            readOnly
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Card>
      )}
    </div>
  )
}

// ─── 事件日志页面 ─────────────────────────────────────────

function LogsTab() {
  const [saveId, setSaveId] = useState('')
  const [searchId, setSearchId] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['tavern-ai-script-logs', searchId],
    queryFn: async () => {
      if (!searchId) return []
      const res = await tavernAdminApi.getAiScriptLogs(searchId, { limit: 50 })
      return unwrapTavernResponse<Array<{
        id: string
        createdAt: string
        events: Array<{ type: string; payload: Record<string, unknown> }>
      }>>(res.data)
    },
    enabled: !!searchId,
  })

  const handleSearch = () => {
    if (!saveId.trim()) {
      void message.warning('请输入 Save ID')
      return
    }
    setSearchId(saveId.trim())
  }

  const columns = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      render: (events: Array<{ type: string; payload: Record<string, unknown> }>) => (
        <div>
          {events.map((e, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <Tag color="blue">{e.type}</Tag>
              <Text code style={{ fontSize: 12 }}>{JSON.stringify(e.payload)}</Text>
            </div>
          ))}
          {events.length === 0 && <Text type="secondary">无事件</Text>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <Input.Search
        placeholder="输入 Save ID 查询事件日志"
        value={saveId}
        onChange={(e) => setSaveId(e.target.value)}
        onSearch={handleSearch}
        enterButton="查询"
        style={{ maxWidth: 400, marginBottom: 16 }}
      />
      {isLoading && <Spin style={{ display: 'block', marginTop: 24 }} />}
      {error && <Text type="danger">查询失败: {(error as Error).message}</Text>}
      {data && data.length === 0 && !isLoading && (
        <Text type="secondary">该存档暂无事件记录</Text>
      )}
      {data && data.length > 0 && (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      )}
    </div>
  )
}

// ─── 主页面 ─────────────────────────────────────────────

const TABS = [
  { key: 'registry', label: '事件注册表', icon: <CodeOutlined />, children: <RegistryTab /> },
  { key: 'state', label: '游戏状态', icon: <DatabaseOutlined />, children: <StateTab /> },
  { key: 'logs', label: '事件日志', icon: <HistoryOutlined />, children: <LogsTab /> },
]

export default function TavernAiScripts() {
  return (
    <div>
      <PageHeader title="AI Script 管理" />
      <Card>
        <Tabs defaultActiveKey="registry" items={TABS} />
      </Card>
    </div>
  )
}
