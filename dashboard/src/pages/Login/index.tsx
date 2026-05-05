import { Form, Input, Button, Card, Typography, message, Checkbox } from 'antd'
import useMobile from '@/hooks/useMobile'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/stores/authStore'
import { getRememberMe } from '@/utils/token'

const { Title } = Typography

interface LoginFormValues {
  username: string
  password: string
  remember: boolean
}

const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)

  const isMobile = useMobile()

  const onFinish = async (values: LoginFormValues) => {
    try {
      await login(values.username, values.password, values.remember)
      message.success('登录成功')
      const redirect = searchParams.get('redirect') || ROUTES.DASHBOARD
      navigate(redirect, { replace: true })
    } catch {
      message.error('登录失败，请检查用户名和密码')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: isMobile ? 'calc(100% - 32px)' : 400,
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          borderRadius: 12,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            FTG 管理后台
          </Title>
          <Typography.Text type="secondary">Food Theme Generator</Typography.Text>
        </div>
        <Form<LoginFormValues>
          onFinish={onFinish}
          autoComplete="off"
          initialValues={{ remember: getRememberMe() }}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>记住我</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login
