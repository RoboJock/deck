import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth.tsx'
import { missingConfig } from './lib/firebase.ts'
import { SignInPage } from './pages/SignInPage.tsx'
import { DecksPage } from './pages/DecksPage.tsx'
import { DeckPage } from './pages/DeckPage.tsx'
import { PublicDeckPage } from './pages/PublicDeckPage.tsx'

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
      <Route path="/" element={<DecksPage />} />
      <Route path="/account" element={<SignInPage />} />
      <Route path="/decks" element={<DecksPage />} />
      <Route path="/decks/:deckId" element={<DeckPage />} />
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
