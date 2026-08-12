import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Erro inesperado na renderização:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className={styles.container} role="alert">
        <div className={styles.card}>
          <p className={styles.eyebrow}>Erro inesperado</p>
          <h1 className={styles.title}>Algo deu errado</h1>
          <p className={styles.message}>
            A aplicação encontrou um problema e não pode continuar nesta tela. Você pode tentar
            recarregar a página.
          </p>
          <button type="button" className={styles.action} onClick={this.handleReload}>
            Recarregar página
          </button>
        </div>
      </div>
    )
  }
}
