import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { UnsavedNotice } from '../components/UnsavedNotice.tsx'
import { copyExampleDeck, examples } from '../lib/examples.ts'
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
  const [copyingId, setCopyingId] = useState<string | null>(null)

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

  async function onCopy(exampleId: string) {
    const example = examples.find((item) => item.id === exampleId)
    if (!example) return
    setCopyingId(exampleId)
    setError(null)
    try {
      const id = await copyExampleDeck(example, user?.uid ?? null)
      navigate(`/decks/${id}`)
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setCopyingId(null)
    }
  }

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
        <div className="home-top">
          <div>
            <h1>{user ? 'Your decks' : 'Make a deck'}</h1>
            <p className="lede">
              {user
                ? 'Decks saved to your account stay here when you come back. The examples below are ready to study or copy.'
                : 'Start with a blank deck, or study an example and copy it. An account is only needed when you want to keep what you make.'}
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
        {yourDecks.length > 0 ? (
          <section className="home-section">
            <h2>Your decks</h2>
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
          </section>
        ) : null}
        <section className="home-section" id="examples">
          <h2>Example decks</h2>
          <p className="lede">
            Study one to see how a deck feels, then copy it and change the cards.
          </p>
          <ul className="deck-list">
            {examples.map((deck) => (
              <li key={deck.id} className="deck-tile">
                <strong>{deck.title}</strong>
                <span className="status">{deck.blurb}</span>
                <span className="status">{deck.cards.length} cards</span>
                <div className="row">
                  <Link className="account-link" to={`/study/${deck.id}`}>
                    Study
                  </Link>
                  <button
                    type="button"
                    className="secondary"
                    disabled={copyingId === deck.id}
                    onClick={() => onCopy(deck.id)}
                  >
                    {copyingId === deck.id ? 'Copying…' : 'Copy'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
