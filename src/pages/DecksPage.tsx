import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { listGuestDecks, migrateGuestDecks, subscribeGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'
import { UnsavedNotice } from '../components/UnsavedNotice.tsx'
import type { DeckRecord, Orientation, Visibility } from '../types.ts'

export function DecksPage() {
  const { user } = useAuth()
  const [decks, setDecks] = useState<DeckRecord[]>([])
  const [guestDecks, setGuestDecks] = useState(listGuestDecks())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
            orientation: (data.orientation === 'horizontal' ? 'horizontal' : 'vertical') as Orientation,
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

  const visibleGuestDecks = user ? [] : guestDecks

  const yourDecks = user
    ? decks.map((deck) => ({
        id: deck.id,
        title: deck.title,
        detail: `${deck.visibility === 'public' ? 'For anyone' : 'For you'} · ${deck.cardCount} cards`,
      }))
    : visibleGuestDecks.map((deck) => ({
        id: deck.id,
        title: deck.title,
        detail: `${deck.cards.length} cards on this browser`,
      }))

  return (
    <div className="frame">
      <main className="wrap">
        <h1>Your decks</h1>
        <p className="lede">
          {user
            ? 'Decks saved to your account stay here when you come back.'
            : 'These decks are stored in this browser until you create an account.'}
        </p>
        {user ? null : <UnsavedNotice />}
        {notice ? <p className="saved">{notice}</p> : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {yourDecks.length === 0 ? (
          <p className="status">No decks yet.</p>
        ) : (
          <ul className="deck-list">
            {yourDecks.map((deck) => (
              <li key={deck.id} className="deck-tile">
                <strong>{deck.title}</strong>
                <span className="status">{deck.detail}</span>
                <div className="row">
                  <Link className="account-link" to={`/decks/${deck.id}`}>
                    Create
                  </Link>
                  <Link className="account-link secondary" to={`/study/${deck.id}`}>
                    Study
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
