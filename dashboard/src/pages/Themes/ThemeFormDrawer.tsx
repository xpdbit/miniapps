/**
 * ThemeFormDrawer — 主题编辑/新建抽屉
 */
import { useMemo } from 'react'
import {
  Drawer,
  Button,
  Space,
  Form,
  Input,
  Select,
  Divider,
  Collapse,
  Tag,
  Alert,
  Typography,
} from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useResponsiveWidth } from '@/hooks/useResponsiveWidth'
import { DRAWER_WIDTH_WIDE } from '@/constants/layout'
import { themeClassesAPI } from '@/services/ftg-api'
import type { Theme, ThemeConfig, ThemeClassItem } from '@/types'

const { Text } = Typography
const { TextArea } = Input

export const DEFAULT_TEMPLATE_MARKUP = `<div class="item-card">
  <div class="item-icon">
    <img src="{{foodImage}}" class="icon-base">
  </div>
  <div class="item-info">
    <div class="item-name">{{foodName}}</div>
    <div class="item-desc">{{foodDescription}}</div>
    <div class="item-calories">{{calories}} 大卡</div>
  </div>
</div>`

export const DEFAULT_CONFIG: ThemeConfig = {
  frame: {
    frameImageId: '',
    borderWidth: 4,
    borderRadius: 12,
    overlayColor: '#000000',
    overlayOpacity: 0.25,
  },
  compose: {
    imageScale: 1,
    offsetX: 0,
    offsetY: 0,
    textTemplate: '{{foodName}}',
    textColor: '#ffffff',
    fontSize: 32,
    textX: 0,
    textY: 0,
  },
}

export const DEFAULT_CONFIG_JSON = JSON.stringify(DEFAULT_CONFIG, null, 2)

export const PREVIEW_MOCK_DATA: Record<string, string> = {
  foodName: '香煎三文鱼',
  foodDescription: '外酥里嫩，搭配柠檬黄油酱汁',
  calories: '320',
  foodImage: 'https://via.placeholder.com/150',
}

export const VARIABLE_LIST = [
  { label: '食物名称', value: '{{foodName}}' },
  { label: '食物描述', value: '{{foodDescription}}' },
  { label: '卡路里', value: '{{calories}}' },
  { label: '食物图片', value: '{{foodImage}}' },
] as const

interface FormValues {
  name: string
  description: string
  shortName: string
  gameName: string
  previewImageUrl: string
  status: 'active' | 'inactive'
}

interface Props {
  open: boolean
  editingTheme: Theme | null
  submitting: boolean
  templateMarkup: string
  selectedClasses: string[]
  oldConfigJson: string
  oldConfigError: string | null
  form: ReturnType<typeof Form.useForm<FormValues>>[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  textareaRef: React.Ref<any>
  previewLoading: boolean
  onTemplateChange: (value: string) => void
  onClassesChange: (classes: string[]) => void
  onOldConfigChange: (value: string) => void
  onInsertVariable: (variable: string) => void
  onPreview: () => void
  onSubmit: () => void
  onClose: () => void
}

const ThemeFormDrawer = ({
  open,
  editingTheme,
  submitting,
  templateMarkup,
  selectedClasses,
  oldConfigJson,
  oldConfigError,
  form,
  textareaRef,
  previewLoading,
  onTemplateChange,
  onClassesChange,
  onOldConfigChange,
  onInsertVariable,
  onPreview,
  onSubmit,
  onClose,
}: Props) => {
  const drawerWidth = useResponsiveWidth(DRAWER_WIDTH_WIDE)

  // ── 查询主题类 ──
  const { data: classList } = useQuery({
    queryKey: ['theme-classes'],
    queryFn: async () => {
      const res = await themeClassesAPI.list()
      const raw = res.data.data?.classes ?? res.data.data ?? []
      return Array.isArray(raw) ? raw : []
    },
    enabled: open,
  })

  const classOptions = useMemo(
    () =>
      (classList ?? []).map((c: ThemeClassItem) => ({
        label: c.name,
        value: c.classId,
      })),
    [classList],
  )

  return (
    <Drawer
      title={editingTheme ? '编辑主题' : '新建主题'}
      open={open}
      onClose={onClose}
      width={drawerWidth}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button icon={<EyeOutlined />} onClick={onPreview} loading={previewLoading}>
            预览
          </Button>
          <Button type="primary" loading={submitting} onClick={onSubmit}>
            {editingTheme ? '保存' : '创建'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ status: 'active' }}>
        {/* 基本信息 */}
        <Divider orientation="left" orientationMargin={0}>基本信息</Divider>

        <Form.Item name="name" label="主题名称" rules={[{ required: true, message: '请输入主题名称' }]}>
          <Input placeholder="例如：春日樱花" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="主题描述（可选）" />
        </Form.Item>

        <Form.Item name="shortName" label="短名称（URL 友好）" rules={[{ required: true, message: '请输入短名称' }]}>
          <Input placeholder="例如：spring-sakura" />
        </Form.Item>

        <Form.Item name="gameName" label="关联游戏" rules={[{ required: true, message: '请输入关联游戏名称' }]}>
          <Input placeholder="例如：原神" />
        </Form.Item>

        <Form.Item name="previewImageUrl" label="预览图 URL">
          <Input placeholder="https://example.com/preview.png（可选）" />
        </Form.Item>

        <Form.Item name="status" label="状态">
          <Select>
            <Select.Option value="active">启用</Select.Option>
            <Select.Option value="inactive">禁用</Select.Option>
          </Select>
        </Form.Item>

        {editingTheme && (
          <Form.Item label="使用次数">
            <Tag color="purple" style={{ fontSize: 13 }}>{editingTheme.usageCount}</Tag>
          </Form.Item>
        )}

        {/* 模板编辑 */}
        <Divider orientation="left" orientationMargin={0}>模板编辑</Divider>

        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 13 }}>插入变量：</Text>
            {VARIABLE_LIST.map((v) => (
              <Button
                key={v.value}
                size="small"
                type="dashed"
                onClick={() => onInsertVariable(v.value)}
                style={{ fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
              >
                {v.value}
              </Button>
            ))}
          </Space>
        </div>

        <TextArea
          ref={textareaRef as React.Ref<any>}
          value={templateMarkup}
          onChange={(e) => onTemplateChange(e.target.value)}
          rows={14}
          style={{
            fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
            fontSize: 13,
            lineHeight: 1.6,
          }}
          placeholder="请输入 HTML 模板标记"
        />

        <div style={{ marginTop: 16 }}>
          <Form.Item label="关联 CSS 类">
            <Select
              mode="multiple"
              placeholder="选择与此主题关联的 CSS 类"
              options={classOptions}
              value={selectedClasses}
              onChange={onClassesChange}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>

        {/* 旧版配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Text type="secondary" style={{ fontSize: 13 }}>旧版配置（兼容）</Text>
        </Divider>

        <Collapse
          items={[
            {
              key: 'old-config',
              label: '展开编辑旧版 JSON 配置',
              children: (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Space>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        编辑主题的 frame 和 compose 配置
                      </Text>
                      {oldConfigJson.trim() && (
                        <Tag color={oldConfigError ? 'red' : 'green'} style={{ fontSize: 11 }}>
                          {oldConfigError ? '格式错误' : '格式正确'}
                        </Tag>
                      )}
                    </Space>
                  </div>

                  <TextArea
                    value={oldConfigJson}
                    onChange={(e) => onOldConfigChange(e.target.value)}
                    rows={10}
                    style={{
                      fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                    placeholder="请输入有效的 JSON 配置"
                  />

                  {oldConfigError && (
                    <Alert type="error" showIcon message="JSON 校验失败" description={oldConfigError} style={{ marginTop: 12 }} />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  )
}

export default ThemeFormDrawer
