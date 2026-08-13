import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './routes/AppRouter'
import { ErrorBoundary } from './ErrorBoundary'

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  )
}
