import { useState, useCallback } from 'react'
import { Layout as AntLayout, Button, theme, Modal, Drawer } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/stores/authStore'
import useMobile from '@/hooks/useMobile'
import ProjectSwitcher from '@/components/ProjectSwitcher'
import Sidebar from './Sidebar'

const { Header, Sider, Content } = AntLayout

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken()
  const isMobile = useMobile(1024) // lg breakpoint

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        logout()
        navigate(ROUTES.LOGIN, { replace: true })
      },
    })
  }

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const toggleMobileDrawer = useCallback(() => {
    setMobileDrawerOpen((prev) => !prev)
  }, [])

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false)
  }, [])

  const handleNavClick = useCallback(() => {
    if (isMobile) {
      closeMobileDrawer()
    }
  }, [isMobile, closeMobileDrawer])

  // 桌面端：可折叠 Sidebar
  const renderDesktopSider = () => (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      breakpoint="lg"
      collapsedWidth={0}
      onBreakpoint={(broken) => {
        if (broken) {
          setCollapsed(true)
        }
      }}
      style={{
        position: isMobile ? 'fixed' : 'relative',
        zIndex: 100,
        height: '100vh',
        overflow: 'auto',
      }}
    >
      <div
        onClick={handleNavClick}
        style={{ height: '100%' }}
      >
        <Sidebar />
      </div>
    </Sider>
  )

  // 移动端：导航按钮 + Drawer 侧边栏
  const renderMobileNav = () => (
    <>
      <Drawer
        title="导航菜单"
        placement="left"
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        width={280}
        styles={{
          body: { padding: 0 },
        }}
      >
        <div onClick={handleNavClick}>
          <Sidebar />
        </div>
      </Drawer>
    </>
  )

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <>
          {/* 移动端：隐藏 Sider，使用 Drawer */}
          {renderMobileNav()}
          <AntLayout>
            <Header
              style={{
                padding: '0 12px',
                background: colorBgContainer,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleMobileDrawer}
              />
              <ProjectSwitcher />
              <Button
                type="text"
                icon={<LogoutOutlined />}
                danger
                onClick={handleLogout}
              />
            </Header>
            <Content
              style={{
                margin: 12,
                padding: 12,
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
                minHeight: 'calc(100vh - 64px - 24px)',
                overflow: 'auto',
              }}
            >
              <Outlet />
            </Content>
          </AntLayout>
        </>
      ) : (
        <>
          {renderDesktopSider()}
          <AntLayout>
            <Header
              style={{
                padding: '0 16px',
                background: colorBgContainer,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={toggleCollapsed}
                />
                <ProjectSwitcher />
              </div>
              <Button type="text" icon={<LogoutOutlined />} danger onClick={handleLogout}>
                退出登录
              </Button>
            </Header>
            <Content
              style={{
                margin: 24,
                padding: 24,
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
                minHeight: 'calc(100vh - 64px - 48px)',
              }}
            >
              <Outlet />
            </Content>
          </AntLayout>
        </>
      )}
    </AntLayout>
  )
}

export default Layout
