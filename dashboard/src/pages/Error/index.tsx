import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const ErrorPage = () => {
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <Result
        status="500"
        title="500"
        subTitle="抱歉，服务器内部错误，请稍后重试"
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.DASHBOARD)}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}

export default ErrorPage
