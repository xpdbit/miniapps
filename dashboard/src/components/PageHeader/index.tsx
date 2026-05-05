import type { ReactNode } from 'react'
import { Button, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import styles from './index.module.scss'

const { Title } = Typography

interface PageHeaderProps {
  title: string
  extra?: ReactNode
  onRefresh?: () => void
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, extra, onRefresh }) => (
  <div className={styles.header}>
    <Title level={2} className={styles.title}>{title}</Title>
    <Space>
      {onRefresh && (
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
        >
          刷新
        </Button>
      )}
      {extra}
    </Space>
  </div>
)

export default PageHeader
