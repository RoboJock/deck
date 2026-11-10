import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { useAuth } from '../useAuth.ts'

export function SignInPage() {
  const { user, ready } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'create'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (ready && user) return <Navigate to="/decks" replace />

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
    <main className="wrap narrow">
      <p className="eyebrow">Deck</p>
      <h1>Flashcards you can share</h1>
      <p className="lede">
        Make a deck, flip through the cards, and mark a deck public when you
        want to send someone the link.
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
          {pending ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}
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
    </main>
  )
}
