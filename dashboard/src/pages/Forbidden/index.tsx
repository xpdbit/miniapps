import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const Forbidden = () => {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有访问此页面的权限"
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.DASHBOARD)}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}

export default Forbidden
