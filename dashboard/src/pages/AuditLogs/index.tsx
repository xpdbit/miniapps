import { useState, useCallback, useMemo } from 'react'
import {
  Typography,
  Table,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Card,
  message,
  Empty,
} from 'antd'
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/services/auditApi'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader'
import type { Dayjs } from 'dayjs'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { AuditLogItem, AuditLogQueryParams } from '@/services/auditApi'

const { Text } = Typography
const { RangePicker } = DatePicker

// --- Action type mappings ---

const ACTION_LABELS: Record<string, string> = {
  LOGIN: '登录',
  CHANGE_PASSWORD: '修改密码',
  CHANGE_ROLE: '角色变更',
  CREATE_PROJECT: '创建项目',
  UPDATE_PROJECT: '更新项目',
  DELETE_PROJECT: '删除项目',
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'blue',
  CHANGE_PASSWORD: 'orange',
  CHANGE_ROLE: 'purple',
  CREATE_PROJECT: 'green',
  UPDATE_PROJECT: 'cyan',
  DELETE_PROJECT: 'red',
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action
}

function getActionColor(action: string): string {
  return ACTION_COLORS[action] || 'default'
}

// --- CSV Export ---

function exportToCsv(rows: AuditLogItem[]): void {
  const header = ['时间', '操作人', '操作类型', '目标类型', '目标ID', 'IP地址', '详情']
  const BOM = '\uFEFF'

  const body = rows.map((row) => {
    const details = row.details ? JSON.stringify(row.details) : ''
    return [
      dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      row.admin.username,
      getActionLabel(row.action),
      row.targetType || '',
      row.targetId || '',
      row.ipAddress || '',
      details,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  })

  const csv = BOM + header.join(',') + '\n' + body.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `审计日志_${dayjs().format('YYYYMMDD_HHmmss')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// --- Component ---

const AuditLogs = () => {
  // Filter state
  const [selectedAdminId, setSelectedAdminId] = useState<number | undefined>(undefined)
  const [selectedAction, setSelectedAction] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })

  // Build query params
  const queryParams: AuditLogQueryParams = useMemo(() => {
    const params: AuditLogQueryParams = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      adminId: selectedAdminId,
      action: selectedAction,
    }
    if (dateRange?.[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
    return params
  }, [pagination, selectedAdminId, selectedAction, dateRange])

  // --- React Query: audit logs ---
  const {
    data: logsData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['auditLogs', queryParams],
    queryFn: async () => {
      const res = await auditApi.list(queryParams)
      return res.data.data
    },
    staleTime: 15_000,
  })

  // --- React Query: action types for filter ---
  const { data: actionsData } = useQuery({
    queryKey: ['auditLogActions'],
    queryFn: async () => {
      const res = await auditApi.getActions()
      return res.data.data.actions
    },
    staleTime: 120_000,
  })

  // --- React Query: admin users for filter ---
  const { data: adminUsers } = useQuery({
    queryKey: ['adminUsersForAudit'],
    queryFn: async () => {
      const res = await auditApi.getAdminUsers()
      return res.data.data.users
    },
    staleTime: 120_000,
    // Gracefully handle 403 if user lacks admin_users permission
    retry: false,
  })

  // --- Handlers ---

  const handleReset = useCallback(() => {
    setSelectedAdminId(undefined)
    setSelectedAction(undefined)
    setDateRange(null)
    setPagination({ current: 1, pageSize: 20 })
  }, [])

  const handleTableChange = useCallback((pag: TablePaginationConfig) => {
    setPagination({
      current: pag.current ?? 1,
      pageSize: pag.pageSize ?? 20,
    })
  }, [])

  const handleExport = useCallback(() => {
    const list = logsData?.list
    if (!list || list.length === 0) {
      message.warning('没有数据可导出')
      return
    }
    exportToCsv(list)
    message.success('导出成功')
  }, [logsData])

  // --- Table columns ---
  const columns: ColumnsType<AuditLogItem> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => (
        <Text type="secondary">{dayjs(val).format('YYYY-MM-DD HH:mm:ss')}</Text>
      ),
    },
    {
      title: '操作人',
      key: 'operator',
      width: 120,
      render: (_: unknown, record: AuditLogItem) => record.admin?.username || `#${record.adminId}`,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (val: string) => (
        <Tag color={getActionColor(val)}>{getActionLabel(val)}</Tag>
      ),
    },
    {
      title: '目标',
      key: 'target',
      width: 160,
      render: (_: unknown, record: AuditLogItem) => {
        if (!record.targetType && !record.targetId) return <Text type="secondary">-</Text>
        return (
          <Text>
            {record.targetType}
            {record.targetId ? ` #${record.targetId}` : ''}
          </Text>
        )
      },
    },
    {
      title: 'IP 地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (val: string | null) => (
        <Text code={!!val} type="secondary">
          {val || '-'}
        </Text>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="审计日志"
        extra={<Button icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>}
      />

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择操作人"
            value={selectedAdminId}
            onChange={setSelectedAdminId}
            allowClear
            style={{ width: 180 }}
            options={adminUsers?.map((u) => ({ label: u.username, value: u.id }))}
            loading={!adminUsers && !Array.isArray(adminUsers)}
          />
          <Select
            placeholder="选择操作类型"
            value={selectedAction}
            onChange={setSelectedAction}
            allowClear
            style={{ width: 160 }}
            options={actionsData?.map((a) => ({ label: getActionLabel(a), value: a }))}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* Data Table */}
      <Table<AuditLogItem>
        columns={columns}
        dataSource={logsData?.list ?? []}
        rowKey="id"
        loading={isLoading || isFetching}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: logsData?.total ?? 0,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total: number) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 800 }}
        expandable={{
          expandedRowRender: (record: AuditLogItem) => {
            if (!record.details) {
              return <Empty description="无详情数据" />
            }
            return (
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  fontSize: 13,
                  background: '#fafafa',
                  borderRadius: 4,
                  maxHeight: 300,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {JSON.stringify(record.details, null, 2)}
              </pre>
            )
          },
          rowExpandable: (record: AuditLogItem) => !!record.details,
        }}
      />
    </div>
  )
}

export default AuditLogs
