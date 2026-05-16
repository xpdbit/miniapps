/**
 * TavernChats — 聊天监控页面
 * 展示聊天会话列表，支持查看消息详情
 */
import { useState } from 'react'
import {
  Typography,
  Table,
  Button,
  Card,
  Space,
  Input,
  Drawer,
  Empty,
  Spin,
  Tag,
  Alert,
  List,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tavernAdminApi } from '@/services/tavern'
import type { TavernChatItem, TavernChatMessage } from '@/services/tavern'
import PageHeader from '@/components/PageHeader'
import { PageSkeleton } from '@/components/PageSkeleton'
import { useResponsiveWidth } from '@/hooks/useResponsiveWidth'
import { DRAWER_WIDTH_WIDE } from '@/constants/layout'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

const TavernChats = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchUser, setSearchUser] = useState('')
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [selectedChat, setSelectedChat] = useState<TavernChatItem | null>(null)
  const drawerWidth = useResponsiveWidth(DRAWER_WIDTH_WIDE)

  // ── 查询聊天列表 ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tavern-chats', page],
    queryFn: async () => {
      const res = await tavernAdminApi.getChats({ page, pageSize: 20 })
      return res.data
    },
  })

  // ── 查询聊天统计 ──
  const { data: chatStats, isLoading: statsLoading } = useQuery({
    queryKey: ['tavern-chat-stats'],
    queryFn: async () => {
      const res = await tavernAdminApi.getChatStats()
      return res.data
    },
  })

  // ── 查询消息详情 ──
  const {
    data: messagesData,
    isFetching: messagesLoading,
  } = useQuery({
    queryKey: ['tavern-chat-messages', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat) return null
      const res = await tavernAdminApi.getChatMessages(selectedChat.id, { page: 1, pageSize: 100 })
      return res.data
    },
    enabled: messagesOpen && !!selectedChat,
  })

  // ── 查看消息 ──
  const handleViewMessages = (chat: TavernChatItem) => {
    setSelectedChat(chat)
    setMessagesOpen(true)
  }

  // ── 消息角色颜色 ──
  const getRoleTag = (role: string) => {
    const config: Record<string, { color: string; label: string }> = {
      user: { color: 'blue', label: '用户' },
      assistant: { color: 'green', label: 'AI' },
      system: { color: 'orange', label: '系统' },
    }
    return config[role] ?? { color: 'default', label: role }
  }

  // ── 表格列 ──
  const columns: ColumnsType<TavernChatItem> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (v: string) => v || '匿名',
    },
    {
      title: '角色',
      dataIndex: 'characterName',
      key: 'characterName',
      width: 130,
    },
    {
      title: '消息数',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 90,
      align: 'right',
    },
    {
      title: '开始时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '最后消息',
      dataIndex: 'lastMessageAt',
      key: 'lastMessageAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: unknown, record: TavernChatItem) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewMessages(record)}
        >
          查看消息
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="聊天监控"
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['tavern-chats'] })
          queryClient.invalidateQueries({ queryKey: ['tavern-chat-stats'] })
        }}
      />

      {/* 统计卡片 */}
      {!statsLoading && chatStats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space size={24} wrap>
            <div>
              <Text type="secondary">今日对话</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>
                {chatStats.totalChatsToday}
              </div>
            </div>
            <div>
              <Text type="secondary">活跃会话</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                {chatStats.activeConversations}
              </div>
            </div>
            <div>
              <Text type="secondary">总消息数</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#fa8c16' }}>
                {chatStats.totalMessages}
              </div>
            </div>
            <div>
              <Text type="secondary">平均会话长度</Text>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#722ed1' }}>
                {chatStats.averageSessionLength}
              </div>
            </div>
          </Space>
        </Card>
      )}

      {/* 筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索用户"
            allowClear
            style={{ width: 200 }}
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            onSearch={() => setPage(1)}
            enterButton={<SearchOutlined />}
          />
        </Space>
      </Card>

      {/* 错误态 */}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="聊天列表加载失败"
          action={<Button size="small" icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['tavern-chats'] })}>重试</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 表格 */}
      {isLoading ? (
        <PageSkeleton type="table" />
      ) : (
        <Table<TavernChatItem>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 个会话`,
          }}
          locale={{ emptyText: <Empty description="暂无聊天记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}

      {/* 消息详情抽屉 */}
      <Drawer
        title={
          selectedChat ? (
            <Space>
              <MessageOutlined />
              <span>聊天消息 - {selectedChat.characterName}</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedChat.userName}
              </Text>
            </Space>
          ) : (
            '聊天消息'
          )
        }
        open={messagesOpen}
        onClose={() => { setMessagesOpen(false); setSelectedChat(null) }}
        width={drawerWidth}
        extra={<Button type="text" onClick={() => setMessagesOpen(false)}>关闭</Button>}
      >
        <Spin spinning={messagesLoading}>
          {messagesData?.items && messagesData.items.length > 0 ? (
            <List
              dataSource={messagesData.items}
              renderItem={(msg: TavernChatMessage) => {
                const role = getRoleTag(msg.role)
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <Space style={{ marginBottom: 4 }}>
                        <Tag color={role.color}>{role.label}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(msg.createdAt).format('MM-DD HH:mm')}
                        </Text>
                        {msg.tokens != null && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {msg.tokens} tokens
                          </Text>
                        )}
                      </Space>
                      <div
                        style={{
                          background: msg.role === 'user' ? '#f6f8fa' : '#f0f5ff',
                          padding: '8px 12px',
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                          fontSize: 13,
                          lineHeight: 1.6,
                          maxHeight: 200,
                          overflow: 'auto',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />
          ) : (
            !messagesLoading && <Empty description="暂无消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </Drawer>
    </div>
  )
}

export default TavernChats
