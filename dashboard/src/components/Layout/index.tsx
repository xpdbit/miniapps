import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout as AntLayout, Button, Modal, theme, Space, Typography, Drawer } from 'antd'
import {
  ControlOutlined,
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
  { id: 'ftg', name: 'FTG', slug: 'ftg', apiBaseUrl: '/api/v1/ftl', description: '食物主题生成器', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'game1', name: 'Game1', slug: 'game1', apiBaseUrl: '/api/v1/game1', description: '挂机放置游戏', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'tavern', name: 'AI-Tavern', slug: 'tavern', apiBaseUrl: '/api/v1/tavern', description: 'AI 角色聊天', status: 'active', createdAt: '', updatedAt: '' },
]

/** 系统管理虚拟项目 */
const SYSTEM_PROJECT: Project = {
  id: 'system',
  name: '系统管理',
  slug: 'system',
  apiBaseUrl: '',
  description: '系统管理后台',
  status: 'active',
  createdAt: '',
  updatedAt: '',
}

/** 系统管理相关路由（用于按钮高亮判断） */
const SYSTEM_ROUTES = [
  ROUTES.SYSTEM,
  ROUTES.DASHBOARD,
  ROUTES.PROJECTS,
  ROUTES.AI_MANAGER,
  ROUTES.MONITORING,
  ROUTES.USERS,
  ROUTES.ADMIN,
  ROUTES.AUDIT_LOGS,
]

const { Header, Sider, Content } = AntLayout
const { Text } = Typography

const Layout = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const currentProject = useProjectStore((state) => state.currentProject)
  const setProjects = useProjectStore((state) => state.setProjects)
  const setProject = useProjectStore((state) => state.setProject)
  const { token: { colorBgContainer, colorPrimary } } = theme.useToken()
  const isMobile = useMobile(1024)
  const { isDark, toggleTheme } = useThemeStore()

  // ─── 加载项目列表 ───
  useEffect(() => {
    const restoreCurrent = (list: Project[]) => {
      const stored = localStorage.getItem('dashboard_last_project')
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { id: string | number }
          // 如果恢复的是真实项目，确保它存在于列表中
          if (parsed.id !== 'system') {
            const exists = list.find((p) => p.id === String(parsed.id))
            if (exists) { setProject(exists); return }
          } else {
            // 恢复系统模式
            setProject(SYSTEM_PROJECT)
            return
          }
        } catch { /* ignore parse error */ }
      }
      // 没有有效存储项目时，默认进系统管理
      setProject(SYSTEM_PROJECT)
    }

    projectApi.list().then((res) => {
      let projects = res.data.data.projects
      // API 返回空列表时使用 fallback（数据库未 seed 的场景）
      if (!projects || projects.length === 0) {
        projects = FALLBACK_PROJECTS
      }
      setProjects(projects)
      restoreCurrent(projects)
    }).catch(() => {
      setProjects(FALLBACK_PROJECTS)
      restoreCurrent(FALLBACK_PROJECTS)
    })
  }, [setProjects, setProject])

  /** 判断当前路径是否属于系统管理范围 */
  const isSystemActive = useMemo(
    () => SYSTEM_ROUTES.some((route) => location.pathname.startsWith(route)),
    [location.pathname]
  )

  const handleSystemClick = useCallback(() => {
    if (currentProject?.id === 'system') return // 已激活则不重复操作
    setProject(SYSTEM_PROJECT)
    navigate(ROUTES.SYSTEM)
  }, [currentProject?.id, setProject, navigate])

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

  // 侧边栏内容（供桌面端 Sider 和移动端 Drawer 复用）
  const sidebarContent = currentProject && <Sidebar />

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
        {/* 左侧：ProjectSwitcher */}
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
            <ProjectSwitcher />
          )}
        </div>

        {/* 右侧：系统管理 + 主题 + 退出 */}
        <Space size={4}>
          <Button
            type="text"
            icon={<ControlOutlined />}
            onClick={handleSystemClick}
            style={{
              fontWeight: isSystemActive ? 600 : 400,
              color: isSystemActive ? colorPrimary : undefined,
              background: isSystemActive
                ? (isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.08)')
                : undefined,
            }}
          >
            系统管理
          </Button>
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          {!isMobile && user && (
            <Text type="secondary" style={{ fontSize: 13, marginRight: 8 }}>
              {user.nickname ?? 'Admin'}
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

      {/* ─── 移动端抽屉导航（展示侧边栏内容） ─── */}
      <Drawer
        title="导航菜单"
        placement="left"
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        {sidebarContent}
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
