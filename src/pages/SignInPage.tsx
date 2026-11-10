import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { listGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'
import { Header } from '../components/Header.tsx'

export function SignInPage() {
  const { user, ready } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'create'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const guestCount = listGuestDecks().length

  if (ready && user) return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === 'create') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="frame">
      <Header showAccount={false} />
      <main className="wrap">
        <p className="eyebrow">Save your decks</p>
        <h1>{mode === 'create' ? 'Create an account' : 'Sign in'}</h1>
        <p className="lede">
          {guestCount > 0
            ? 'An account saves the decks in this browser. Without one, those decks disappear from this browser when its saved data is cleared.'
            : 'An account keeps your decks and lets you share a link. You can still make a deck first and save it later.'}
        </p>
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              minLength={6}
              value={password}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending || !ready}>
            {pending ? 'Working…' : mode === 'create' ? 'Create account and save' : 'Sign in and save'}
          </button>
        </form>
        <button
          type="button"
          className="text"
          onClick={() => {
            setMode(mode === 'create' ? 'sign-in' : 'create')
            setError(null)
          }}
        >
          {mode === 'create'
            ? 'Already have an account? Sign in'
            : 'Need an account? Create one'}
        </button>
        <p className="status">
          <Link className="text" to="/">
            Back to decks
          </Link>
        </p>
      </main>
    </div>
  )
}
