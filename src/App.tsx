import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth.tsx'
import { useAuth } from './useAuth.ts'
import { missingConfig } from './lib/firebase.ts'
import { SignInPage } from './pages/SignInPage.tsx'
import { DecksPage } from './pages/DecksPage.tsx'
import { DeckPage } from './pages/DeckPage.tsx'
import { PublicDeckPage } from './pages/PublicDeckPage.tsx'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <main className="wrap">
        <p className="status">Checking your session…</p>
      </main>
    )
  }
  if (!user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  if (missingConfig.length > 0) {
    return (
      <main className="wrap">
        <h1>Firebase config is missing</h1>
        <p className="status">
          Add {missingConfig.join(', ')} to <code>.env.local</code>, then restart
          the dev server.
        </p>
      </main>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />
      <Route
        path="/decks"
        element={
          <RequireAuth>
            <DecksPage />
          </RequireAuth>
        }
      />
      <Route
        path="/decks/:deckId"
        element={
          <RequireAuth>
            <DeckPage />
          </RequireAuth>
        }
      />
      <Route path="/d/:deckId" element={<PublicDeckPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
