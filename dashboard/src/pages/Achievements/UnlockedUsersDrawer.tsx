/**
 * Achievements — 已解锁用户抽屉
 */
import { Drawer, Button, Spin, Card, Descriptions, Tag, Empty, List, Space, Typography } from 'antd'
import useMobile from '@/hooks/useMobile'
import type { Achievement, UnlockedUser } from '@/services/achievementApi'
import { getConditionTypeConfig, maskOpenId } from './constants'
import dayjs from 'dayjs'

const { Text } = Typography

interface Props {
  open: boolean
  viewingAchievement: Achievement | null
  unlockedUsers: UnlockedUser[] | undefined
  usersLoading: boolean
  onClose: () => void
}

const UnlockedUsersDrawer = ({ open, viewingAchievement, unlockedUsers, usersLoading, onClose }: Props) => {
  const isMobile = useMobile()

  return (
    <Drawer
      title={
        viewingAchievement ? (
          <Space>
            <span style={{ fontSize: 22 }}>{viewingAchievement.icon}</span>
            <span>{viewingAchievement.name} - 已解锁用户</span>
          </Space>
        ) : (
          '已解锁用户'
        )
      }
      placement="right"
      width={isMobile ? '100%' : 480}
      open={open}
      onClose={onClose}
      extra={
        <Button type="text" onClick={onClose}>
          关闭
        </Button>
      }
    >
      {viewingAchievement && (
        <Spin spinning={usersLoading}>
          {/* 成就概要 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="成就">{viewingAchievement.name}</Descriptions.Item>
              <Descriptions.Item label="描述">{viewingAchievement.description}</Descriptions.Item>
              <Descriptions.Item label="条件类型">
                <Tag color={getConditionTypeConfig(viewingAchievement.conditionType).color}>
                  {getConditionTypeConfig(viewingAchievement.conditionType).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标值">
                <span style={{ fontWeight: 600 }}>{viewingAchievement.conditionValue}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 用户列表 */}
          {(!unlockedUsers || unlockedUsers.length === 0) && !usersLoading ? (
            <Empty description="暂无用户解锁此成就" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List
              size="small"
              dataSource={unlockedUsers ?? []}
              loading={usersLoading}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 位用户`,
                size: 'small',
              }}
              renderItem={(item: UnlockedUser, index: number) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#f0f5ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#1677ff',
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {index + 1}
                      </div>
                    }
                    title={<span style={{ fontSize: 14 }}>{item.userName || '匿名用户'}</span>}
                    description={
                      <Space>
                        <Text
                          copyable={{ text: item.userOpenId }}
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                          type="secondary"
                        >
                          {maskOpenId(item.userOpenId)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          解锁于 {dayjs(item.unlockedAt).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      )}
    </Drawer>
  )
}

export default UnlockedUsersDrawer
