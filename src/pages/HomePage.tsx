import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { loadDailyPile } from '../lib/daily.ts'
import { examples } from '../lib/examples.ts'
import { createGuestDeck, migrateGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [waiting, setWaiting] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDailyPile(user?.uid ?? null)
      .then((pile) => {
        if (!cancelled) setWaiting(pile.length)
      })
      .catch(() => {
        if (!cancelled) setWaiting(0)
      })
    return () => {
      cancelled = true
    }
  }, [user])

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
        <div className="home-stage">
          <div className="home-intro">
            <h1>Make a deck</h1>
            <p className="lede">
              Put a prompt on the front and the answer on the back, then flip through the cards.
            </p>
            <p className="lede">
              {waiting === null
                ? 'Checking today’s cards.'
                : waiting === 0
                  ? 'Nothing is waiting today.'
                  : null}
              {waiting !== null && waiting > 0 ? (
                <Link to="/daily">
                  {waiting === 1 ? '1 card is waiting today.' : `${waiting} cards are waiting today.`}
                </Link>
              ) : null}
            </p>
            <form className="home-form" onSubmit={onCreate}>
              <label>
                <span className="option-label">New deck</span>
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
            {!user ? (
              <p className="status">
                Without an account, a deck stays in this browser and cannot be listed publicly.
              </p>
            ) : null}
          </div>
          <article className="index-card home-sample" aria-hidden="true">
            <p className="card-kicker">Front</p>
            <p className="card-face">hacer</p>
            <p className="card-kicker back-kicker">Back</p>
            <p className="card-face">to do or to make</p>
          </article>
        </div>
        <section className="home-examples">
          <h2>Or flip through a finished deck</h2>
          <ul className="home-picks">
            {examples.map((deck) => (
              <li key={deck.id}>
                <Link className="home-pick" to={`/study/${deck.id}`}>
                  <strong>{deck.title}</strong>
                  <span>{deck.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
