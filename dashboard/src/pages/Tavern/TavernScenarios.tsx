/**
 * TavernScenarios — Scenario 剧本管理列表页
 * 展示所有内置和自定义剧本，支持导入 JSON
 */
import { useState } from 'react'
import {
  Card, Row, Col, Tag, Typography, Input, Modal, Button,
  Spin, Empty, message, Space, Popconfirm,
} from 'antd'
import {
  ImportOutlined, ExportOutlined,
  DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import { ROUTES } from '@/constants/routes'
import PageHeader from '@/components/PageHeader'

const { Text } = Typography
const { TextArea } = Input

interface ScenarioSummary {
  id: string
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  dimensionCount: number
  characterCount: number
  source: 'builtin' | 'custom'
}

export default function TavernScenarios() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importing, setImporting] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['tavern-scenarios'],
    queryFn: async () => {
      const res = await tavernAdminApi.getScenarios()
      return unwrapTavernResponse<ScenarioSummary[]>(res.data)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tavernAdminApi.deleteScenario(id),
    onSuccess: () => {
      message.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['tavern-scenarios'] })
    },
    onError: () => message.error('删除失败'),
  })

  const importMutation = useMutation({
    mutationFn: async (json: string) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        throw new Error('JSON 格式无效')
      }
      // 先校验
      const validateRes = await tavernAdminApi.validateScenario(parsed)
      const validateData = unwrapTavernResponse<{ valid: boolean; errors: string[] }>(validateRes.data)
      if (!validateData.valid) {
        throw new Error(validateData.errors.join('\n'))
      }
      await tavernAdminApi.createScenario(parsed)
    },
    onSuccess: () => {
      message.success('导入成功')
      setImportOpen(false)
      setImportJson('')
      queryClient.invalidateQueries({ queryKey: ['tavern-scenarios'] })
    },
    onError: (err: Error) => message.error(err.message),
  })

  const handleImport = () => {
    setImporting(true)
    importMutation.mutate(importJson, { onSettled: () => setImporting(false) })
  }

  const filtered = (data ?? []).filter(s =>
    !search || s.name.includes(search) || s.description.includes(search) || s.tags.some(t => t.includes(search)),
  )

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="📜 Scenario 剧本管理"
        extra={
          <Space>
            <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
              导入 JSON
            </Button>
          </Space>
        }
      />

      <Input.Search
        placeholder="搜索剧本名称、描述、标签..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 400, marginBottom: 24 }}
        allowClear
      />

      {isLoading && <Spin style={{ display: 'block', marginTop: 48 }} />}
      {error && <Text type="danger">加载失败: {(error as Error).message}</Text>}

      {!isLoading && filtered.length === 0 && (
        <Empty description={search ? '无匹配结果' : '暂无剧本'} />
      )}

      <Row gutter={[16, 16]}>
        {filtered.map(s => (
          <Col key={s.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              actions={[
                <EditOutlined key="edit" onClick={() => navigate(`${ROUTES.TAVERN_SCENARIO_EDIT.replace(':id', s.id)}`)} />,
                <ExportOutlined key="export" onClick={async () => {
                  const res = await tavernAdminApi.getScenario(s.id)
                  const scenario = unwrapTavernResponse<unknown>(res.data)
                  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${s.id}.scenario.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  message.success('已导出')
                }} />,
                s.source !== 'builtin' ? (
                  <Popconfirm
                    key="delete"
                    title="确认删除此剧本？"
                    onConfirm={() => deleteMutation.mutate(s.id)}
                  >
                    <DeleteOutlined style={{ color: '#ff4d4f' }} />
                  </Popconfirm>
                ) : null,
              ].filter(Boolean)}
            >
              <Card.Meta
                title={
                  <Space>
                    <Text strong>{s.name}</Text>
                    <Tag color={s.source === 'builtin' ? 'blue' : 'green'}>
                      {s.source === 'builtin' ? '内置' : '自定义'}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <Text type="secondary" ellipsis style={{ marginBottom: 8, display: 'block' }}>
                      {s.description}
                    </Text>
                    <Space size={[4, 4]} wrap style={{ marginBottom: 8 }}>
                      {s.tags.map(t => <Tag key={t} color="default" style={{ fontSize: 11 }}>{t}</Tag>)}
                    </Space>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {s.dimensionCount}维度 · {s.characterCount}角色 · v{s.version} · {s.author}
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="导入 Scenario JSON"
        open={importOpen}
        onOk={handleImport}
        onCancel={() => { setImportOpen(false); setImportJson('') }}
        confirmLoading={importing}
        okText="导入"
      >
        <TextArea
          rows={12}
          value={importJson}
          onChange={e => setImportJson(e.target.value)}
          placeholder='粘贴完整的 Scenario JSON...&#10;或从文件内容复制'
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </div>
  )
}
