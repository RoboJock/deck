import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import {
  createGuestDeck,
  listGuestDecks,
  migrateGuestDecks,
  subscribeGuestDecks,
} from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'
import { Header } from '../components/Header.tsx'
import { UnsavedNotice } from '../components/UnsavedNotice.tsx'
import type { DeckRecord, Visibility } from '../types.ts'

export function DecksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [decks, setDecks] = useState<DeckRecord[]>([])
  const [guestDecks, setGuestDecks] = useState(listGuestDecks())
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => subscribeGuestDecks(() => setGuestDecks(listGuestDecks())), [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    migrateGuestDecks(user.uid)
      .then((count) => {
        if (!cancelled && count > 0) {
          setNotice(
            count === 1
              ? 'Saved 1 deck from this browser to your account.'
              : `Saved ${count} decks from this browser to your account.`,
          )
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(explain(caught))
      })

    const decksQuery = query(collection(db, 'decks'), where('ownerId', '==', user.uid))
    const unsubscribe = onSnapshot(
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
        next.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
        setDecks(next)
        setError(null)
      },
      (caught) => setError(explain(caught)),
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)
    try {
      if (!user) {
        const deck = createGuestDeck(trimmed)
        navigate(`/decks/${deck.id}`)
        return
      }
      const ref = await addDoc(collection(db, 'decks'), {
        ownerId: user.uid,
        title: trimmed,
        visibility: 'private',
        cardCount: 0,
        createdAt: serverTimestamp(),
      })
      navigate(`/decks/${ref.id}`)
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  const visibleGuestDecks = user ? [] : guestDecks

  return (
    <div className="frame">
      <Header />
      <main className="wrap">
        <h1>{user ? 'Your decks' : 'Make a deck'}</h1>
        <p className="lede">
          {user
            ? 'Decks saved to your account stay here when you come back.'
            : 'Start now. An account is only needed when you want to keep the deck.'}
        </p>
        <div className={user ? undefined : 'split'}>
          {user ? null : <UnsavedNotice />}
          <form className="stack" onSubmit={onCreate}>
          <label>
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
        </div>
        {notice ? <p className="saved">{notice}</p> : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="status">
          Your decks and public decks from other people are in the sidebar.
          {visibleGuestDecks.length + decks.length === 0 ? ' No decks yet.' : ''}
        </p>
      </main>
    </div>
  )
}
