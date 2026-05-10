import { Component, type ReactNode } from 'react'
import './app.scss'

interface AppProps {
  children: ReactNode
}

class App extends Component<AppProps> {
  componentDidMount() {}

  componentDidShow() {}

  componentDidHide() {}

  componentDidCatchError() {}

  render() {
    return this.props.children
  }
}

export default App
