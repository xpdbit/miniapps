import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const NotFound = () => {
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
        status="404"
        title="404"
        subTitle="抱歉，您访问的页面不存在"
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.DASHBOARD)}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}

export default NotFound
