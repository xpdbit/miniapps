import { Component, type ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'
import './app.scss'

interface AppProps {
  children: ReactNode
}

class App extends Component<AppProps> {
  componentDidMount() {
    void useAuthStore.getState().restoreSession()
  }

  componentDidShow() {
    // 小程序切前台时刷新配额
    if (useAuthStore.getState().isLoggedIn) {
      void useAuthStore.getState().refreshQuota()
    }
  }

  componentDidHide() {}

  componentDidCatchError(err: string) {
    console.error('[tavern] App error:', err)
  }

  render() {
    return this.props.children
  }
}

export default App
