/**
 * ThemeCard — 主题卡片组件
 */
import { Card, Col, Typography, Tag, Space, Tooltip, Button, Popconfirm } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { Theme } from '@/types'

const { Text } = Typography

interface Props {
  theme: Theme
  index: number
  isFirst: boolean
  isLast: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onEdit: (theme: Theme) => void
  onToggleStatus: (theme: Theme) => void
  onDelete: (theme: Theme) => void
}

const ThemeCard = ({
  theme,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onToggleStatus,
  onDelete,
}: Props) => {
  return (
    <Col xs={24} sm={12} lg={8} xl={6} key={theme.id}>
      <Card
        hoverable
        style={{ borderRadius: 8, height: '100%' }}
        cover={
          <div
            style={{
              height: 180,
              background: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
            }}
          >
            {theme.previewImageUrl ? (
              <img
                alt={theme.name}
                src={theme.previewImageUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://via.placeholder.com/320x180?text=加载失败'
                }}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: 14 }}>
                暂无预览图
              </Text>
            )}
          </div>
        }
        actions={[
          <Tooltip title="上移" key="up">
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={isFirst}
              onClick={() => onMoveUp(index)}
            />
          </Tooltip>,
          <Tooltip title="下移" key="down">
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={isLast}
              onClick={() => onMoveDown(index)}
            />
          </Tooltip>,
          <Tooltip title="编辑" key="edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(theme)}
            />
          </Tooltip>,
          <Tooltip title={theme.status === 'active' ? '禁用' : '启用'} key="toggle">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onToggleStatus(theme)}
            />
          </Tooltip>,
          <Popconfirm
            title="确认删除"
            description={`确定要删除主题「${theme.name}」吗？如果该主题被食物记录引用，将无法删除。`}
            onConfirm={() => onDelete(theme)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            key="delete"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>,
        ]}
      >
        <Card.Meta
          title={
            <Space align="center" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong ellipsis style={{ maxWidth: 140 }} title={theme.name}>
                {theme.name}
              </Text>
              <Tag color={theme.status === 'active' ? 'green' : 'default'} style={{ flexShrink: 0, margin: 0 }}>
                {theme.status === 'active' ? '启用' : '禁用'}
              </Tag>
            </Space>
          }
          description={
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Text type="secondary" ellipsis style={{ fontSize: 13 }}>
                {theme.gameName}
              </Text>
              <Space size={4} wrap>
                <Tag color="blue" style={{ fontSize: 11, lineHeight: '18px' }}>
                  排序: {theme.sortOrder}
                </Tag>
                <Tag color="purple" style={{ fontSize: 11, lineHeight: '18px' }}>
                  使用: {theme.usageCount}
                </Tag>
              </Space>
            </Space>
          }
        />
      </Card>
    </Col>
  )
}

export default ThemeCard
