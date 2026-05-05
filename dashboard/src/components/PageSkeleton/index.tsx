import { Card, Col, Row, Skeleton, Space } from 'antd'

export type SkeletonType = 'table' | 'cards' | 'detail' | 'dashboard'

export interface PageSkeletonProps {
  type: SkeletonType
  rows?: number
}

const PageSkeleton: React.FC<PageSkeletonProps> = ({ type, rows = 5 }) => {
  switch (type) {
    case 'table':
      return (
        <div style={{ padding: 24 }}>
          {/* Filter bar skeleton */}
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Skeleton.Input active style={{ width: 200 }} />
              <Skeleton.Input active style={{ width: 140 }} />
              <Skeleton.Button active style={{ width: 80 }} />
            </Space>
          </Card>
          {/* Table skeleton */}
          <Card>
            <Skeleton active paragraph={{ rows }} title={{ width: '30%' }} />
          </Card>
        </div>
      )

    case 'cards':
      return (
        <div style={{ padding: 24 }}>
          <Row gutter={[16, 16]}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} lg={8} xl={6}>
                <Card>
                  <Skeleton active paragraph={{ rows: 3 }} />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )

    case 'detail':
      return (
        <div style={{ padding: 24 }}>
          <Card>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </div>
      )

    case 'dashboard':
      return (
        <div style={{ padding: 24 }}>
          {/* Stat cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Col key={i} xs={12} sm={8} lg={6}>
                <Card>
                  <Skeleton active paragraph={{ rows: 1 }} title={{ width: '50%' }} />
                </Card>
              </Col>
            ))}
          </Row>
          {/* Charts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card>
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card>
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            </Col>
          </Row>
        </div>
      )
  }
}

export default PageSkeleton
