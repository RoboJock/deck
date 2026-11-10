import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { deleteEach, updateEach } from '../lib/batch.ts'
import { useAuth } from '../useAuth.ts'
import { StudyCards } from '../components/StudyCards.tsx'
import type { CardRecord, DeckRecord, Visibility } from '../types.ts'

export function DeckPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [deck, setDeck] = useState<DeckRecord | null>(null)
  const [missing, setMissing] = useState(false)
  const [cards, setCards] = useState<CardRecord[]>([])
  const [mode, setMode] = useState<'edit' | 'study'>('edit')
  const [title, setTitle] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const deckRef = doc(db, 'decks', deckId)
    return onSnapshot(
      deckRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDeck(null)
          setMissing(true)
          return
        }
        const data = snapshot.data()
        const next: DeckRecord = {
          id: snapshot.id,
          ownerId: String(data.ownerId ?? ''),
          title: String(data.title ?? ''),
          visibility: data.visibility === 'public' ? 'public' : 'private',
          cardCount: Number(data.cardCount ?? 0),
          createdAt: data.createdAt ?? null,
        }
        setDeck(next)
        setTitle(next.title)
        setMissing(false)
      },
      (caught) => setError(explain(caught)),
    )
  }, [deckId])

  useEffect(() => {
    if (!user) return
    const cardsQuery = query(
      collection(db, 'decks', deckId, 'cards'),
      where('ownerId', '==', user.uid),
    )
    return onSnapshot(
      cardsQuery,
      (snapshot) => {
        const next = snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            ref: item.ref,
            ownerId: String(data.ownerId ?? ''),
            visibility: (data.visibility === 'public' ? 'public' : 'private') as Visibility,
            front: String(data.front ?? ''),
            back: String(data.back ?? ''),
            order: Number(data.order ?? 0),
          }
        })
        next.sort((a, b) => a.order - b.order)
        setCards(next)
      },
      (caught) => setError(explain(caught)),
    )
  }, [deckId, user])

  async function saveTitle(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!deck || !trimmed || trimmed === deck.title) return
    setPending(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'decks', deck.id), { title: trimmed })
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  async function changeVisibility(next: Visibility) {
    if (!deck || next === deck.visibility) return
    setPending(true)
    setError(null)
    try {
      const refs = cards.map((card) => card.ref)
      const deckRef = doc(db, 'decks', deck.id)
      // Cards may only be public while the deck is public, so the writes
      // have to happen in that order.
      if (next === 'private') {
        await updateEach(refs, { visibility: 'private' })
        await updateDoc(deckRef, { visibility: 'private' })
      } else {
        await updateDoc(deckRef, { visibility: 'public' })
        await updateEach(refs, { visibility: 'public' })
      }
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  async function addCard(event: FormEvent) {
    event.preventDefault()
    if (!user || !deck) return
    const trimmedFront = front.trim()
    const trimmedBack = back.trim()
    if (!trimmedFront || !trimmedBack) return
    setPending(true)
    setError(null)
    try {
      const cardRef = doc(collection(db, 'decks', deck.id, 'cards'))
      const batch = writeBatch(db)
      batch.set(cardRef, {
        ownerId: user.uid,
        visibility: deck.visibility,
        front: trimmedFront,
        back: trimmedBack,
        order: Date.now(),
      })
      batch.update(doc(db, 'decks', deck.id), { cardCount: increment(1) })
      await batch.commit()
      setFront('')
      setBack('')
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  async function removeCard(card: CardRecord) {
    if (!deck) return
    setPending(true)
    setError(null)
    try {
      const batch = writeBatch(db)
      batch.delete(card.ref)
      batch.update(doc(db, 'decks', deck.id), { cardCount: increment(-1) })
      await batch.commit()
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  async function removeDeck() {
    if (!deck) return
    if (!window.confirm(`Delete “${deck.title}” and all of its cards?`)) return
    setPending(true)
    setError(null)
    try {
      await deleteEach(cards.map((card) => card.ref))
      await deleteDoc(doc(db, 'decks', deck.id))
      navigate('/decks')
    } catch (caught) {
      setError(explain(caught))
      setPending(false)
    }
  }

  async function copyLink() {
    const link = `${window.location.origin}/d/${deckId}`
    try {
      await navigator.clipboard.writeText(link)
      setNotice('Link copied.')
    } catch {
      setNotice(link)
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
        <Link className="text back" to="/decks">
          All decks
        </Link>
        {missing ? <h1>This deck no longer exists.</h1> : null}
        {deck ? (
          <>
            <form className="create" onSubmit={saveTitle}>
              <label className="grow">
                Title
                <input
                  value={title}
                  maxLength={100}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="secondary"
                disabled={pending || title.trim() === deck.title || title.trim().length === 0}
              >
                Save title
              </button>
            </form>
            <div className="row spread">
              <div className="row tight">
                <button
                  type="button"
                  className={deck.visibility === 'private' ? '' : 'secondary'}
                  disabled={pending}
                  onClick={() => changeVisibility('private')}
                >
                  Private
                </button>
                <button
                  type="button"
                  className={deck.visibility === 'public' ? '' : 'secondary'}
                  disabled={pending}
                  onClick={() => changeVisibility('public')}
                >
                  Public
                </button>
              </div>
              <button type="button" className="danger" disabled={pending} onClick={removeDeck}>
                Delete deck
              </button>
            </div>
            {deck.visibility === 'public' ? (
              <p className="status">
                Anyone with the link can flip these cards.{' '}
                <button type="button" className="text" onClick={copyLink}>
                  Copy link
                </button>
              </p>
            ) : (
              <p className="status">Only you can open this deck.</p>
            )}
            {notice ? <p className="status">{notice}</p> : null}
            <div className="row tight">
              <button
                type="button"
                className={mode === 'edit' ? '' : 'secondary'}
                onClick={() => setMode('edit')}
              >
                Cards
              </button>
              <button
                type="button"
                className={mode === 'study' ? '' : 'secondary'}
                onClick={() => setMode('study')}
              >
                Study
              </button>
            </div>
            {mode === 'study' ? (
              <StudyCards cards={cards} />
            ) : (
              <>
                <form className="stack" onSubmit={addCard}>
                  <label>
                    Front
                    <textarea
                      value={front}
                      maxLength={600}
                      required
                      onChange={(event) => setFront(event.target.value)}
                    />
                  </label>
                  <label>
                    Back
                    <textarea
                      value={back}
                      maxLength={600}
                      required
                      onChange={(event) => setBack(event.target.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending || front.trim().length === 0 || back.trim().length === 0}
                  >
                    Add card
                  </button>
                </form>
                {cards.length === 0 ? (
                  <p className="status">No cards yet.</p>
                ) : (
                  <ul className="card-list">
                    {cards.map((card, index) => (
                      <li key={card.id} className="card-row">
                        <span>
                          <strong>
                            {index + 1}. {card.front}
                          </strong>
                          <span className="status">{card.back}</span>
                        </span>
                        <button
                          type="button"
                          className="danger"
                          disabled={pending}
                          onClick={() => removeCard(card)}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        ) : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    </>
  )
}
