/**
 * TavernScenarioEdit — Scenario 剧本编辑器
 * JSON 编辑 + Schema 校验 + 导出
 */
import { useState, useEffect } from 'react'
import {
  Card, Input, Button, Space, message, Alert,
  Typography, Row, Col, Tag,
} from 'antd'
import {
  SaveOutlined, CheckCircleOutlined, ExportOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { tavernAdminApi, unwrapTavernResponse } from '@/services/tavern'
import { ROUTES } from '@/constants/routes'
import PageHeader from '@/components/PageHeader'

const { Text } = Typography
const { TextArea } = Input

interface ScenarioData {
  meta?: { name?: string; version?: string; author?: string; tags?: string[] }
  world?: { dimensions?: Array<Record<string, unknown>> }
  characters?: Array<Record<string, unknown>>
}

export default function TavernScenarioEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [jsonText, setJsonText] = useState('')
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null)

  const { data: scenario, isLoading } = useQuery({
    queryKey: ['tavern-scenario', id],
    queryFn: async () => {
      const res = await tavernAdminApi.getScenario(id!)
      return unwrapTavernResponse<ScenarioData>(res.data)
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (scenario) setJsonText(JSON.stringify(scenario, null, 2))
  }, [scenario])

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed: unknown
      try { parsed = JSON.parse(jsonText) } catch { throw new Error('JSON 格式无效') }
      const validateRes = await tavernAdminApi.validateScenario(parsed)
      const validateData = unwrapTavernResponse<{ valid: boolean; errors: string[] }>(validateRes.data)
      setValidation(validateData)
      if (!validateData.valid) throw new Error(validateData.errors[0] ?? '校验失败')
      await tavernAdminApi.updateScenario(id!, parsed)
    },
    onSuccess: () => message.success('保存成功'),
    onError: (err: Error) => message.error(err.message),
  })

  const handleValidate = async () => {
    try {
      const parsed = JSON.parse(jsonText)
      const res = await tavernAdminApi.validateScenario(parsed)
      const data = unwrapTavernResponse<{ valid: boolean; errors: string[] }>(res.data)
      setValidation(data)
      if (data.valid) message.success('Schema 校验通过')
    } catch { setValidation({ valid: false, errors: ['JSON 格式无效'] }) }
  }

  const handleExport = () => {
    try {
      JSON.parse(jsonText)
      const blob = new Blob([jsonText], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${id}.scenario.json`; a.click()
      URL.revokeObjectURL(url)
      message.success('已导出')
    } catch { message.error('JSON 格式无效，无法导出') }
  }

  const meta = scenario?.meta
  const dims = scenario?.world?.dimensions
  const chars = scenario?.characters
  const nameForDisplay = meta?.name ?? id ?? ''

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title={`✏️ 编辑剧本: ${nameForDisplay}`}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTES.TAVERN_SCENARIOS)}>返回列表</Button>
            <Button icon={<CheckCircleOutlined />} onClick={handleValidate}>校验 Schema</Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>保存</Button>
          </Space>
        }
      />

      {validation?.valid === false && (
        <Alert type="error" message="Schema 校验失败"
          description={<ul style={{ margin: 0, paddingLeft: 20 }}>{validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          showIcon closable style={{ marginBottom: 16 }} />
      )}
      {validation?.valid === true && (
        <Alert type="success" message="Schema 校验通过 ✅" showIcon closable style={{ marginBottom: 16 }} />
      )}

      {isLoading && <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>}
      {!isLoading && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Text type="secondary">版本</Text><br /><Text strong>{meta?.version as string ?? '-'}</Text></Card></Col>
            <Col span={6}><Card size="small"><Text type="secondary">作者</Text><br /><Text strong>{meta?.author as string ?? '-'}</Text></Card></Col>
            <Col span={6}><Card size="small"><Text type="secondary">维度数</Text><br /><Text strong>{dims?.length ?? 0}</Text></Card></Col>
            <Col span={6}><Card size="small"><Text type="secondary">角色数</Text><br /><Text strong>{chars?.length ?? 0}</Text></Card></Col>
          </Row>
          {meta?.tags && <div style={{ marginBottom: 12 }}>{meta.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}</div>}
          <Card title="JSON 编辑">
            <TextArea value={jsonText} onChange={e => { setJsonText(e.target.value); setValidation(null) }} rows={30}
              style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: 13, lineHeight: 1.6 }}
              placeholder="输入 Scenario JSON..." />
          </Card>
        </>
      )}
    </div>
  )
}
