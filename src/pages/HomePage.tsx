import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { createGuestDeck, migrateGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'
import { UnsavedNotice } from '../components/UnsavedNotice.tsx'

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

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
    return () => {
      cancelled = true
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

  return (
    <div className="frame">
      <main className="wrap">
        <div className="home-top">
          <div>
            <h1>Make a deck</h1>
            <p className="lede">
              {user
                ? 'Name a deck and start adding cards. Saved decks stay with your account.'
                : 'Name a deck and start adding cards. An account is only needed when you want to keep what you make.'}
            </p>
            {user ? null : <UnsavedNotice />}
          </div>
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
      </main>
    </div>
  )
}
