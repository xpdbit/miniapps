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
