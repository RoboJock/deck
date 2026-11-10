import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth.tsx'
import { Header } from './components/Header.tsx'
import { missingConfig } from './lib/firebase.ts'
import { SignInPage } from './pages/SignInPage.tsx'
import { DecksPage } from './pages/DecksPage.tsx'
import { DeckPage } from './pages/DeckPage.tsx'
import { StudyPage } from './pages/StudyPage.tsx'

function Shell() {
  return (
    <div className="app-shell">
      <Header />
      <Outlet />
    </div>
  )
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
      <Route element={<Shell />}>
        <Route path="/" element={<DecksPage />} />
        <Route path="/account" element={<SignInPage />} />
        <Route path="/decks" element={<DecksPage />} />
        <Route path="/decks/:deckId" element={<DeckPage />} />
        <Route path="/study/:deckId" element={<StudyPage />} />
        <Route path="/d/:deckId" element={<StudyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
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
