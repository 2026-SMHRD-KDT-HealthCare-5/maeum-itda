import { Component, type ErrorInfo, type ReactNode } from 'react'
import characterImage from '../shared/assets/character/character-daseul-error.webp'
import { Button } from '../shared/ui'
import styles from './ErrorBoundary.module.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// 렌더링 중 잡히지 않은 예외가 앱 전체를 빈 화면으로 만드는 것을 막는 최후 방어선.
// API 요청 실패는 각 기능의 try/catch가 처리해야 하고, 여기까지 오는 건 예상 못 한 버그다.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('처리되지 않은 렌더링 오류', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrapper}>
          <img className={styles.character} src={characterImage} alt="" />
          <p className={styles.message}>앗, 죄송해요! 문제가 생겼나봐요. 금방 고쳐놓을게요!</p>
          <Button type="button" onClick={() => window.location.reload()}>
            이전으로
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
