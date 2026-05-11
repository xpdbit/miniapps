import { Form, Input, Button, Card, Typography, message, Checkbox } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/stores/authStore'
import { getRememberMe } from '@/utils/token'
import styles from '@/styles/pages/login.module.scss'

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
    <div className={styles.loginContainer}>
      <Card className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <Title level={3} style={{ marginBottom: 4 }}>
            统一管理后台
          </Title>
          <Typography.Text type="secondary">个人小程序工坊</Typography.Text>
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
