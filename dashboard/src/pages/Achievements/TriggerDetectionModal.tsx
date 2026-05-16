/**
 * Achievements — 手动触发成就检测弹窗
 */
import { Modal, Space, Button, Form, Input, Select, Popconfirm, Alert } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import useMobile from '@/hooks/useMobile'
import type { Achievement } from '@/services/achievementApi'

interface TriggerFormValues {
  userOpenId: string
  achievementId?: string
}

interface Props {
  open: boolean
  form: ReturnType<typeof Form.useForm<TriggerFormValues>>[0]
  loading: boolean
  achievements: Achievement[] | undefined
  isSuccess: boolean
  onCancel: () => void
  onSubmit: () => void
}

const TriggerDetectionModal = ({ open, form, loading, achievements, isSuccess, onCancel, onSubmit }: Props) => {
  const isMobile = useMobile()

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          <span>手动触发成就检测</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={isMobile ? '100%' : 480}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Popconfirm
            title="确认触发检测"
            description="系统将根据当前数据检测该用户是否符合成就条件，确认执行？"
            onConfirm={onSubmit}
            okText="确认执行"
            cancelText="取消"
            okButtonProps={{ loading }}
          >
            <Button type="primary" icon={<ThunderboltOutlined />}>
              执行检测
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ userOpenId: '', achievementId: undefined }}>
        <Alert
          type="warning"
          showIcon
          message="操作说明"
          description="手动触发将重新检测指定用户的成就进度。该操作将基于当前数据运行完整检测逻辑。"
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          name="userOpenId"
          label="用户 OpenID"
          rules={[
            { required: true, message: '请输入用户的 OpenID' },
            { min: 4, message: 'OpenID 长度不足' },
          ]}
        >
          <Input placeholder="输入用户 OpenID" />
        </Form.Item>

        <Form.Item name="achievementId" label="指定成就（可选）">
          <Select
            allowClear
            placeholder="不指定则检测所有成就"
            loading={!achievements}
            options={(achievements ?? []).map((a) => ({
              value: a.id,
              label: `${a.icon} ${a.name}`,
            }))}
          />
        </Form.Item>

        {isSuccess && (
          <Alert
            type="success"
            showIcon
            message="检测完成"
            description="已成功执行检测。"
            style={{ marginTop: 8 }}
          />
        )}
      </Form>
    </Modal>
  )
}

export default TriggerDetectionModal
