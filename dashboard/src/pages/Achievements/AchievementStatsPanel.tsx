/**
 * Achievements — 统计面板组件
 * 展示总用户数、解锁率、各成就完成率、最近解锁活动
 */
import { Card, Row, Col, Statistic, Progress, List, Space, Empty, Alert, Button, Spin, Typography } from 'antd'
import {
  ReloadOutlined,
  UserOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'

const { Text } = Typography
import dayjs from 'dayjs'
import { maskOpenId } from './constants'

import type { AchievementStats } from '@/services/achievementApi'

interface Props {
  stats: AchievementStats | undefined
  statsLoading: boolean
  statsError: boolean
}

const getProgressColor = (rate: number): string => {
  if (rate >= 80) return '#52c41a'
  if (rate >= 50) return '#1677ff'
  if (rate >= 20) return '#faad14'
  return '#ff4d4f'
}

const AchievementStatsPanel = ({ stats, statsLoading, statsError }: Props) => {
  const queryClient = useQueryClient()

  return (
    <>
      {/* 错误态 */}
      {statsError && !statsLoading && (
        <Alert
          type="error"
          showIcon
          message="统计面板加载失败"
          description="无法获取成就统计数据，请稍后重试。"
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['achievements-stats'] })}
            >
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={statsLoading}>
        {stats && (
          <>
            {/* 概览卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <Card hoverable>
                  <Statistic
                    title="总用户数"
                    value={stats.totalUsers}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#1677ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card hoverable>
                  <Statistic
                    title="已解锁用户数"
                    value={stats.unlockedUsersCount}
                    suffix={`/ ${stats.totalUsers}`}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card hoverable>
                  <Statistic
                    title="总体解锁率"
                    value={Math.round(stats.overallUnlockRate * 100) / 100}
                    suffix="%"
                    precision={1}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: getProgressColor(stats.overallUnlockRate) }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 各成就完成率 */}
            <Card title="各成就完成率" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 12]}>
                {stats.achievementRates.map((item) => {
                  const ratePercent = Math.round(item.rate * 100)
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={item.achievementId}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text
                            ellipsis
                            style={{ fontSize: 13, maxWidth: 160 }}
                            title={item.achievementName}
                          >
                            {item.achievementName}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                            {item.unlockedCount}/{item.totalCount}
                          </Text>
                        </div>
                        <Progress
                          percent={ratePercent}
                          size="small"
                          strokeColor={getProgressColor(item.rate * 100)}
                          showInfo={false}
                        />
                      </div>
                    </Col>
                  )
                })}
              </Row>
            </Card>

            {/* 最近解锁活动 */}
            <Card
              title={
                <Space>
                  <span>最近解锁活动</span>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                    （最近 10 条）
                  </Text>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              {stats.recentUnlocks.length === 0 ? (
                <Empty description="暂无解锁记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={stats.recentUnlocks}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space size={4}>
                            <TrophyOutlined style={{ color: '#faad14' }} />
                            <Text strong>{item.achievementName}</Text>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.userName || maskOpenId(item.userOpenId)} ·{' '}
                            {dayjs(item.unlockedAt).format('YYYY-MM-DD HH:mm')}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </>
        )}

        {/* Stats 无数据（非加载也非错误） */}
        {!stats && !statsLoading && !statsError && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Empty description="暂无统计数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        )}
      </Spin>
    </>
  )
}

export default AchievementStatsPanel
