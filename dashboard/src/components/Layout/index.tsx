import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout as AntLayout, Button, Menu, theme, Modal, Space, Typography, Drawer } from 'antd'
import {
  DashboardOutlined,
  SettingOutlined,
  MonitorOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { projectApi } from '@/services/projectApi'
import useMobile from '@/hooks/useMobile'
import ProjectSwitcher from '@/components/ProjectSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import { useThemeStore } from '@/stores/themeStore'
import type { Project } from '@/types'

/** 默认项目列表（API 加载失败时的 fallback） */
const FALLBACK_PROJECTS: Project[] = [
  { id: 1, name: 'FTG', apiBaseUrl: '/api/ftl', description: '食物主题生成器', status: 'active', createdAt: '', updatedAt: '' },
  { id: 2, name: 'Game1', apiBaseUrl: '/api/v1/game1', description: '挂机放置游戏', status: 'active', createdAt: '', updatedAt: '' },
  { id: 3, name: 'AI-Tavern', apiBaseUrl: '/api/tavern', description: 'AI 角色聊天', status: 'active', createdAt: '', updatedAt: '' },
]

const { Header, Sider, Content } = AntLayout
const { Text } = Typography

/** 顶部导航菜单项 */
const NAV_ITEMS: { key: string; icon: React.ReactNode; label: string }[] = [
  { key: ROUTES.DASHBOARD, icon: <DashboardOutlined />, label: '总览' },
  { key: ROUTES.PROJECTS, icon: <SettingOutlined />, label: '配置' },
  { key: ROUTES.MONITORING, icon: <MonitorOutlined />, label: '监控' },
  { key: ROUTES.USERS, icon: <UserOutlined />, label: '用户管理' },
]

const Layout = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const currentProject = useProjectStore((state) => state.currentProject)
  const setProjects = useProjectStore((state) => state.setProjects)
  const setProject = useProjectStore((state) => state.setProject)
  const { token: { colorBgContainer } } = theme.useToken()
  const isMobile = useMobile(1024)
  const { isDark, toggleTheme } = useThemeStore()

  // ─── 加载项目列表 ───
  useEffect(() => {
    projectApi.list().then((res) => {
      const projects = res.data.data.projects
      setProjects(projects)
      const stored = sessionStorage.getItem('currentProject')
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { id: number }
          const exists = projects.find((p) => p.id === parsed.id)
          if (exists) setProject(exists)
        } catch { /* ignore parse error */ }
      }
    }).catch(() => {
      setProjects(FALLBACK_PROJECTS)
      const stored = sessionStorage.getItem('currentProject')
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { id: number }
          const exists = FALLBACK_PROJECTS.find((p) => p.id === parsed.id)
          if (exists) setProject(exists)
        } catch { /* ignore parse error */ }
      } else if (FALLBACK_PROJECTS.length > 0) {
        setProject(FALLBACK_PROJECTS[0]!)
      }
    })
  }, [setProjects, setProject])

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

  const toggleMobileDrawer = useCallback(() => {
    setMobileDrawerOpen((prev) => !prev)
  }, [])

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false)
  }, [])

  const handleNavClick = useCallback((info: { key: string }) => {
    navigate(info.key)
    if (isMobile) {
      closeMobileDrawer()
    }
  }, [navigate, isMobile, closeMobileDrawer])

  /** 当前选中的导航 key */
  const selectedKey = useMemo(() => {
    // 匹配当前路径的高亮项
    const matching = NAV_ITEMS.find((item) => location.pathname.startsWith(item.key))
    return matching?.key ?? ''
  }, [location.pathname])

  // ─── 桌面端导航菜单 ───
  const navMenu = (
    <Menu
      mode="horizontal"
      selectedKeys={[selectedKey]}
      items={NAV_ITEMS}
      onClick={handleNavClick}
      style={{
        flex: 1,
        border: 'none',
        background: 'transparent',
        minWidth: 0,
      }}
    />
  )

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* ─── 顶部导航栏 ─── */}
      <Header
        style={{
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
          height: 56,
          lineHeight: '56px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* 左侧：导航 + 项目选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
          {isMobile ? (
            <>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleMobileDrawer}
              />
              <ProjectSwitcher />
            </>
          ) : (
            <>
              <ProjectSwitcher />
              {navMenu}
            </>
          )}
        </div>

        {/* 右侧：主题 + 退出 */}
        <Space size={4}>
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          {!isMobile && user && (
            <Text type="secondary" style={{ fontSize: 13, marginRight: 8 }}>
              {user.username}
            </Text>
          )}
          <Button
            type="text"
            icon={<LogoutOutlined />}
            danger
            onClick={handleLogout}
          >
            {isMobile ? '' : '退出'}
          </Button>
        </Space>
      </Header>

      {/* ─── 移动端抽屉导航 ─── */}
      <Drawer
        title="导航菜单"
        placement="left"
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="vertical"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={handleNavClick}
          style={{ border: 'none' }}
        />
      </Drawer>

      {/* ─── 主区域（侧栏 + 内容） ─── */}
      <AntLayout style={{ minHeight: 'calc(100vh - 56px)' }}>
        {!isMobile && currentProject && (
          <Sider
            width={220}
            theme="dark"
            style={{
              overflow: 'auto',
              height: 'calc(100vh - 56px)',
              position: 'sticky',
              top: 56,
            }}
          >
            <Sidebar />
          </Sider>
        )}
        <Content
          style={{
            background: colorBgContainer,
            padding: isMobile ? 12 : 24,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
