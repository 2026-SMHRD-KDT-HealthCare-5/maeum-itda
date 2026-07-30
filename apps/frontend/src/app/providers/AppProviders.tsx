import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { SessionProvider } from '../../entities/user'
import { QueryProvider } from './QueryProvider'

// Composition root for every app-wide provider. main.tsx should only ever
// need to import this one component.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </SessionProvider>
    </QueryProvider>
  )
}
