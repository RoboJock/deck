import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { useAuth } from '../useAuth.ts'
import type { DeckRecord, Visibility } from '../types.ts'

export function DecksPage() {
  const { user } = useAuth()
  const [decks, setDecks] = useState<DeckRecord[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!user) return
    const decksQuery = query(
      collection(db, 'decks'),
      where('ownerId', '==', user.uid),
    )
    return onSnapshot(
      decksQuery,
      (snapshot) => {
        const next = snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            ownerId: String(data.ownerId ?? ''),
            title: String(data.title ?? ''),
            visibility: (data.visibility === 'public' ? 'public' : 'private') as Visibility,
            cardCount: Number(data.cardCount ?? 0),
            createdAt: data.createdAt ?? null,
          }
        })
        next.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() ?? 0
          const bTime = b.createdAt?.toMillis() ?? 0
          return bTime - aTime
        })
        setDecks(next)
        setError(null)
      },
      (caught) => setError(explain(caught)),
    )
  }, [user])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    const trimmed = title.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)
    try {
      await addDoc(collection(db, 'decks'), {
        ownerId: user.uid,
        title: trimmed,
        visibility: 'private',
        cardCount: 0,
        createdAt: serverTimestamp(),
      })
      setTitle('')
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <header className="top">
        <Link to="/decks" className="brand">
          Deck
        </Link>
        <div className="row tight">
          <span className="status">{user?.email}</span>
          <button type="button" className="secondary" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>
      <main className="wrap">
        <h1>Your decks</h1>
        <form className="create" onSubmit={onCreate}>
          <label className="grow">
            New deck
            <input
              value={title}
              maxLength={100}
              placeholder="Spanish verbs"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <button type="submit" disabled={pending || title.trim().length === 0}>
            {pending ? 'Creating…' : 'Create deck'}
          </button>
        </form>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {decks.length === 0 ? (
          <p className="status">No decks yet. Create one to add cards.</p>
        ) : (
          <ul className="deck-list">
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link className="deck-row" to={`/decks/${deck.id}`}>
                  <span>
                    <strong>{deck.title}</strong>
                    <span className="status">
                      {deck.visibility === 'public' ? 'Public' : 'Private'}
                      {' · '}
                      {deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'}
                    </span>
                  </span>
                  <span className="status">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
