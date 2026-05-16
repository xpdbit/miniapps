/**
 * Achievements — 编辑成就配置弹窗
 */
import { Modal, Space, Button, Form, Input, InputNumber, Descriptions, Divider, Tag, Alert } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import useMobile from '@/hooks/useMobile'
import type { Achievement } from '@/services/achievementApi'
import { getConditionTypeConfig } from './constants'

interface EditFormValues {
  icon: string
  description: string
  conditionValue: number
  themeId: number | null
}

interface Props {
  open: boolean
  editingAchievement: Achievement | null
  form: ReturnType<typeof Form.useForm<EditFormValues>>[0]
  loading: boolean
  onCancel: () => void
  onSubmit: () => void
}

const AchievementEditModal = ({ open, editingAchievement, form, loading, onCancel, onSubmit }: Props) => {
  const isMobile = useMobile()

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>编辑成就配置</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={isMobile ? '100%' : 560}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={loading} onClick={onSubmit}>
            保存
          </Button>
        </Space>
      }
    >
      {editingAchievement && (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            icon: editingAchievement.icon,
            description: editingAchievement.description,
            conditionValue: editingAchievement.conditionValue,
            themeId: editingAchievement.themeId,
          }}
        >
          {/* 当前成就信息（只读） */}
          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="名称">
              <Space>
                <span style={{ fontSize: 18 }}>{editingAchievement.icon}</span>
                <span style={{ fontWeight: 600 }}>{editingAchievement.name}</span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="条件类型">
              <Tag color={getConditionTypeConfig(editingAchievement.conditionType).color}>
                {getConditionTypeConfig(editingAchievement.conditionType).label}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '0 0 16px' }} />

          <Form.Item
            name="icon"
            label="图标 (Emoji)"
            rules={[{ required: true, message: '请输入 Emoji 图标' }]}
          >
            <Input placeholder="例如：🏆🌟🎯" maxLength={4} style={{ fontSize: 24 }} />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[
              { required: true, message: '请输入成就描述' },
              { max: 200, message: '描述不超过 200 字符' },
            ]}
          >
            <Input.TextArea rows={2} placeholder="输入成就描述" maxLength={200} showCount />
          </Form.Item>

          <Form.Item
            name="conditionValue"
            label={
              <span>
                条件目标值{' '}
                <span style={{ color: '#999', fontSize: 12 }}>
                  （当前类型：{getConditionTypeConfig(editingAchievement.conditionType).label}）
                </span>
              </span>
            }
            rules={[
              { required: true, message: '请输入条件目标值' },
              { type: 'number', min: 1, message: '目标值必须 ≥ 1' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={99999} placeholder="输入目标值" />
          </Form.Item>

          <Form.Item name="themeId" label="关联主题 ID（可选）">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="输入主题 ID，留空表示不关联" />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="注意"
            description="条件类型为系统设定，不可更改。预设成就不支持删除。"
            style={{ marginTop: 8 }}
          />
        </Form>
      )}
    </Modal>
  )
}

export default AchievementEditModal
