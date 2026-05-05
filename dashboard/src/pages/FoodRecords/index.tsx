import { useState, useCallback } from 'react'
import {
  Typography,
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Checkbox,
  Space,
  Tag,
  Drawer,
  Descriptions,
  Image,
  Popconfirm,
  message,
  Row,
  Col,
  Divider,
  Card,
  Empty,
  Spin,
} from 'antd'
import useMobile from '@/hooks/useMobile'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { recordsAPI, themesAPI } from '@/services/ftg-api'
import type { FoodRecordListItem } from '@/services/ftg-api'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import type { PaginationProps } from 'antd'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ─── 食物类型映射 ────────────────────────────────
const FOOD_TYPE_MAP: Record<string, { label: string; color: string }> = {
  breakfast: { label: '早餐', color: 'orange' },
  lunch: { label: '午餐', color: 'cyan' },
  dinner: { label: '晚餐', color: 'purple' },
  main: { label: '正餐', color: 'blue' },
  snack: { label: '零食', color: 'pink' },
  dessert: { label: '甜点', color: 'magenta' },
  drink: { label: '饮品', color: 'geekblue' },
  fruit: { label: '水果', color: 'green' },
}

const FOOD_TYPE_OPTIONS = Object.entries(FOOD_TYPE_MAP).map(([value, { label }]) => ({
  value,
  label,
}))

// ─── 工具函数 ──────────────────────────────────
const maskOpenId = (openId: string): string => {
  if (!openId) return '-'
  if (openId.length <= 6) return openId.slice(0, 3) + '***'
  return openId.slice(0, 3) + '****' + openId.slice(-4)
}

const getFoodTypeConfig = (type: string) =>
  FOOD_TYPE_MAP[type] ?? { label: type || '未知', color: 'default' }

// ─── 组件 ──────────────────────────────────────
const FoodRecords = () => {
  const queryClient = useQueryClient()

  // ── 筛选状态 ──
  const [foodName, setFoodName] = useState('')
  const [foodType, setFoodType] = useState<string | undefined>(undefined)
  const [themeId, setThemeId] = useState<number | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)

  // ── 分页 & 选择 ──
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  // ── 详情抽屉 ──
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const isMobile = useMobile()

  // ── 查询参数 ──
  const queryParams = {
    page,
    pageSize,
    foodName: foodName || undefined,
    foodType,
    themeId,
    startDate: dateRange?.[0],
    endDate: dateRange?.[1],
    showDeleted: showDeleted || undefined,
  }

  // ── 请求列表 ──
  const {
    data: listRes,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['food-records', queryParams],
    queryFn: async () => {
      const res = await recordsAPI.list(queryParams)
      return res.data.data
    },
  })

  // ── 请求主题列表（供筛选器用） ──
  const { data: themesRes } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const res = await themesAPI.list()
      return res.data.data?.themes ?? res.data ?? []
    },
  })
  const themes = Array.isArray(themesRes) ? themesRes : []

  // ── 请求详情 ──
  const { data: detailData, isFetching: detailLoading } = useQuery({
    queryKey: ['food-record-detail', detailId],
    queryFn: async () => {
      if (!detailId) return null
      const res = await recordsAPI.getById(detailId)
      return res.data.data.record
    },
    enabled: !!detailId && drawerOpen,
  })

  // ── 操作 ──
  const handleSearch = useCallback((value: string) => {
    setFoodName(value)
    setPage(1)
    setSelectedRowKeys([])
  }, [])

  const handleResetFilters = () => {
    setFoodName('')
    setFoodType(undefined)
    setThemeId(undefined)
    setDateRange(null)
    setShowDeleted(false)
    setPage(1)
    setSelectedRowKeys([])
  }

  const handleViewDetail = (id: number) => {
    setDetailId(id)
    setDrawerOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await recordsAPI.delete(id)
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['food-records'] })
      setSelectedRowKeys((prev) => prev.filter((k) => k !== id))
    } catch {
      // apiClient 拦截器已处理错误
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await recordsAPI.restore(id)
      message.success('恢复成功')
      queryClient.invalidateQueries({ queryKey: ['food-records'] })
    } catch {
      // apiClient 拦截器已处理错误
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录')
      return
    }
    try {
      await recordsAPI.batchDelete(selectedRowKeys)
      message.success(`批量删除成功 (${selectedRowKeys.length} 条)`)
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['food-records'] })
    } catch {
      // apiClient 拦截器已处理错误
    }
  }

  const handlePaginationChange: PaginationProps['onChange'] = (p, ps) => {
    setPage(p)
    setPageSize(ps)
    setSelectedRowKeys([])
  }

  // ── 表格列 ──
  const columns: ColumnsType<FoodRecordListItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: '缩略图',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnail',
      width: 80,
      render: (url: string) =>
        url ? (
          <Image
            src={url}
            alt="食物缩略图"
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMjUiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2JmYmZiZiIgZm9udC1zaXplPSIxMCI+Tk9JTUc8L3RleHQ+PC9zdmc+"
          />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: '#bfbfbf',
            }}
          >
            无图
          </div>
        ),
    },
    {
      title: '食物名',
      dataIndex: 'foodName',
      key: 'foodName',
      ellipsis: true,
      width: 150,
    },
    {
      title: '类型',
      dataIndex: 'foodType',
      key: 'foodType',
      width: 100,
      render: (type: string) => {
        const config = getFoodTypeConfig(type)
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '主题',
      dataIndex: 'themeName',
      key: 'themeName',
      width: 120,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: '用户 OpenID',
      dataIndex: 'userOpenId',
      key: 'userOpenId',
      width: 160,
      render: (openId: string) => (
        <Text copyable={{ text: openId }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {maskOpenId(openId)}
        </Text>
      ),
    },
    {
      title: '热量',
      dataIndex: 'calories',
      key: 'calories',
      width: 90,
      align: 'right',
      render: (cal: number) => (
        <Text strong>{cal ?? '-'} kcal</Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'deletedAt',
      key: 'status',
      width: 80,
      filters: [
        { text: '正常', value: 'normal' },
        { text: '已删除', value: 'deleted' },
      ],
      render: (deletedAt: string | null) =>
        deletedAt ? (
          <Tag color="red">已删除</Tag>
        ) : (
          <Tag color="green">正常</Tag>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: unknown, record: FoodRecordListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            查看
          </Button>
          {record.deletedAt ? (
            <Popconfirm
              title="确认恢复"
              description="确定要恢复此食物记录吗？"
              onConfirm={() => handleRestore(record.id)}
              okText="恢复"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<UndoOutlined />}>
                恢复
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确认删除"
              description="确定要删除此食物记录吗？（软删除）"
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ── 详情抽屉内容 ──
  const renderDetailDrawer = () => {
    if (!detailData) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          {detailLoading ? <Spin size="large" tip="加载中..." /> : <Empty description="无数据" />}
        </div>
      )
    }

    const d = detailData
    const foodTypeConfig = getFoodTypeConfig(d.foodType)

    return (
      <Spin spinning={detailLoading}>
        {/* 图片预览 */}
        <Card title="图片预览" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                原图
              </Text>
              <Image
                src={d.originalImageUrl}
                alt="食物原图"
                style={{ width: '100%', borderRadius: 6, maxHeight: 240, objectFit: 'cover' }}
                fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjEwMCIgeT0iODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjYmZiZmJmIiBmb250LXNpemU9IjE0Ij7ml6Dlm74gTG9hZCBFcnJvcjwvdGV4dD48L3N2Zz4="
              />
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                主题合成图
              </Text>
              <Image
                src={d.themeImageUrl}
                alt="主题合成图"
                style={{ width: '100%', borderRadius: 6, maxHeight: 240, objectFit: 'cover' }}
                fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjEwMCIgeT0iODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjYmZiZmJmIiBmb250LXNpemU9IjE0Ij7ml6Dlm74gTG9hZCBFcnJvcjwvdGV4dD48L3N2Zz4="
              />
            </Col>
          </Row>
          {d.themeName && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">主题：</Text>
              <Tag>{d.themeName}</Tag>
            </div>
          )}
        </Card>

        {/* 基本信息 */}
        <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="食物名">{d.foodName}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={foodTypeConfig.color}>{foodTypeConfig.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="热量">
              <Text strong>{d.calories} kcal</Text>
            </Descriptions.Item>
            <Descriptions.Item label="用户 OpenID">
              <Text copyable={{ text: d.userOpenId }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {maskOpenId(d.userOpenId)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(d.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(d.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              {d.deletedAt ? (
                <Tag color="red">已删除（{dayjs(d.deletedAt).format('YYYY-MM-DD HH:mm')}）</Tag>
              ) : (
                <Tag color="green">正常</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* AI 描述 */}
        <Card title="AI 描述" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong style={{ fontSize: 13 }}>简短描述</Text>
              <Divider style={{ margin: '4px 0' }} />
              <Text>{d.aiDescription?.short || '-'}</Text>
            </div>
            <div>
              <Text strong style={{ fontSize: 13 }}>游戏化风格</Text>
              <Divider style={{ margin: '4px 0' }} />
              <Text>{d.aiDescription?.gameStyle || '-'}</Text>
            </div>
            <div>
              <Text strong style={{ fontSize: 13 }}>详细描述</Text>
              <Divider style={{ margin: '4px 0' }} />
              <Text>{d.aiDescription?.detail || '-'}</Text>
            </div>
          </Space>
        </Card>

        {/* 营养详情 */}
        <Card title="营养详情" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  background: '#fff7e6',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: '#fa8c16' }}>
                  {d.nutrition?.protein ?? '-'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>蛋白质 (g)</Text>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  background: '#fff0f0',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: '#f5222d' }}>
                  {d.nutrition?.fat ?? '-'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>脂肪 (g)</Text>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  background: '#f6ffed',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>
                  {d.nutrition?.carbs ?? '-'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>碳水 (g)</Text>
              </div>
            </Col>
            {d.nutrition?.fiber !== undefined && (
              <Col span={24}>
                <Text type="secondary">
                  膳食纤维：{d.nutrition.fiber} g
                </Text>
              </Col>
            )}
          </Row>
        </Card>

        {/* 位置信息 */}
        {d.location && (
          <Card title="位置信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="地点名称">
                {d.location.locationName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="纬度">
                {d.location.latitude ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="经度">
                {d.location.longitude ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 关联打卡记录 */}
        <Card title="关联打卡记录" size="small">
          {d.checkInRecords && d.checkInRecords.length > 0 ? (
            <Table
              dataSource={d.checkInRecords}
              columns={[
                { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
                {
                  title: '打卡日期',
                  dataIndex: 'checkInDate',
                  key: 'checkInDate',
                  render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
                },
                { title: '餐别', dataIndex: 'mealType', key: 'mealType' },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          ) : (
            <Empty description="暂无关联打卡记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Spin>
    )
  }

  // ── 渲染 ──
  return (
    <div>
      {/* 页面标题 & 操作 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          食物记录
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['food-records'] })}
          >
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="确认批量删除"
              description={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？（软删除）`}
              onConfirm={handleBatchDelete}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <Input.Search
              placeholder="搜索食物名称"
              allowClear
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="食物类型"
              allowClear
              style={{ width: '100%' }}
              value={foodType}
              onChange={(v) => {
                setFoodType(v)
                setPage(1)
              }}
              options={FOOD_TYPE_OPTIONS}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="选择主题"
              allowClear
              showSearch
              style={{ width: '100%' }}
              value={themeId}
              onChange={(v) => {
                setThemeId(v)
                setPage(1)
              }}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={themes.map((t: { id: number; name: string }) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={7} lg={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={
                dateRange
                  ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
                  : null
              }
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                } else {
                  setDateRange(null)
                }
                setPage(1)
              }}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col xs={12} sm={6} md={3} lg={2}>
            <Checkbox
              checked={showDeleted}
              onChange={(e) => {
                setShowDeleted(e.target.checked)
                setPage(1)
              }}
            >
              显示已删除
            </Checkbox>
          </Col>
          <Col>
            <Button onClick={handleResetFilters}>重置</Button>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Table<FoodRecordListItem>
        rowKey="id"
        columns={columns}
        dataSource={listRes?.records ?? []}
        loading={isLoading || isFetching}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total: listRes?.total ?? 0,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: handlePaginationChange,
        }}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
      />

      {/* 详情抽屉 */}
      <Drawer
        title={
          detailData
            ? `食物详情 - ${detailData.foodName}`
            : '食物详情'
        }
        placement="right"
        width={isMobile ? '100%' : 600}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setDetailId(null)
        }}
        extra={
          <Button type="text" onClick={() => setDrawerOpen(false)}>
            关闭
          </Button>
        }
      >
        {renderDetailDrawer()}
      </Drawer>
    </div>
  )
}

export default FoodRecords
