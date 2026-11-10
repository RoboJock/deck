import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { deleteEach, updateEach } from '../lib/batch.ts'
import {
  addGuestCard,
  deleteGuestCard,
  deleteGuestDeck,
  getGuestDeck,
  isGuestDeckId,
  subscribeGuestDecks,
  updateGuestCard,
  updateGuestDeck,
} from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'
import { UnsavedNotice } from '../components/UnsavedNotice.tsx'
import type { CardRecord, DeckRecord, Visibility } from '../types.ts'

export function DeckPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const { user, ready } = useAuth()
  const guest = isGuestDeckId(deckId)
  const [deck, setDeck] = useState<DeckRecord | null>(null)
  const [missing, setMissing] = useState(false)
  const [cards, setCards] = useState<CardRecord[]>([])
  const [title, setTitle] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const syncedTitle = useRef<string | null>(null)

  function rememberTitle(nextTitle: string) {
    if (syncedTitle.current === nextTitle) return
    syncedTitle.current = nextTitle
    setTitle(nextTitle)
  }

  useEffect(() => {
    if (!guest) return
    const pull = () => {
      const found = getGuestDeck(deckId)
      if (!found) {
        setDeck(null)
        setCards([])
        setMissing(true)
        return
      }
      setMissing(false)
      setDeck({
        id: found.id,
        ownerId: '',
        title: found.title,
        visibility: found.visibility,
        cardCount: found.cards.length,
        createdAt: null,
      })
      rememberTitle(found.title)
      setCards(
        found.cards
          .map((card) => ({
            id: card.id,
            ownerId: '',
            visibility: found.visibility,
            front: card.front,
            back: card.back,
            order: card.order,
          }))
          .sort((a, b) => a.order - b.order),
      )
    }
    pull()
    return subscribeGuestDecks(pull)
  }, [deckId, guest])

  useEffect(() => {
    if (guest || !user) return
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
        const nextTitle = String(data.title ?? '')
        setDeck({
          id: snapshot.id,
          ownerId: String(data.ownerId ?? ''),
          title: nextTitle,
          visibility: data.visibility === 'public' ? 'public' : 'private',
          cardCount: Number(data.cardCount ?? 0),
          createdAt: data.createdAt ?? null,
        })
        rememberTitle(nextTitle)
        setMissing(false)
      },
      (caught) => setError(explain(caught)),
    )
  }, [deckId, guest, user])

  useEffect(() => {
    if (guest || !user) return
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
  }, [deckId, guest, user])

  async function saveTitle(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!deck || !trimmed || trimmed === deck.title) return
    setPending(true)
    setError(null)
    try {
      if (guest) updateGuestDeck(deck.id, { title: trimmed })
      else await updateDoc(doc(db, 'decks', deck.id), { title: trimmed })
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
      if (guest) {
        updateGuestDeck(deck.id, { visibility: next })
        return
      }
      const refs = cards.flatMap((card) => (card.ref ? [card.ref] : []))
      const deckRef = doc(db, 'decks', deck.id)
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
    if (!deck) return
    const trimmedFront = front.trim()
    const trimmedBack = back.trim()
    if (!trimmedFront || !trimmedBack) return
    setPending(true)
    setError(null)
    try {
      if (guest) {
        addGuestCard(deck.id, trimmedFront, trimmedBack)
      } else if (user) {
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
      }
      setFront('')
      setBack('')
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  async function saveCard(event: FormEvent) {
    event.preventDefault()
    const card = cards.find((item) => item.id === editingId)
    const trimmedFront = editFront.trim()
    const trimmedBack = editBack.trim()
    if (!deck || !card || !trimmedFront || !trimmedBack) return
    setPending(true)
    setError(null)
    try {
      if (guest) updateGuestCard(deck.id, card.id, trimmedFront, trimmedBack)
      else if (card.ref) await updateDoc(card.ref, { front: trimmedFront, back: trimmedBack })
      setEditingId(null)
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
      if (guest) {
        deleteGuestCard(deck.id, card.id)
      } else if (card.ref) {
        const batch = writeBatch(db)
        batch.delete(card.ref)
        batch.update(doc(db, 'decks', deck.id), { cardCount: increment(-1) })
        await batch.commit()
      }
      if (editingId === card.id) setEditingId(null)
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
      if (guest) deleteGuestDeck(deck.id)
      else {
        await deleteEach(cards.flatMap((card) => (card.ref ? [card.ref] : [])))
        await deleteDoc(doc(db, 'decks', deck.id))
      }
      navigate('/')
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

  const needsSignIn = ready && !user && !guest

  return (
    <div className="frame">
      <main className="wrap">
        {needsSignIn ? (
          <>
            <h1>Sign in to open this deck</h1>
            <p className="lede">Saved decks belong to an account.</p>
            <Link className="account-link" to="/account">
              Sign in
            </Link>
          </>
        ) : null}
        {missing ? <h1>This deck no longer exists.</h1> : null}
        {guest ? <UnsavedNotice /> : null}
        {deck ? (
          <>
            <div className="editor-top">
            <div>
            <form className="stack" onSubmit={saveTitle}>
              <label>
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
            <div className="choices">
              <button
                type="button"
                className={deck.visibility === 'private' ? '' : 'secondary'}
                disabled={pending}
                onClick={() => changeVisibility('private')}
              >
                For you
              </button>
              <button
                type="button"
                className={deck.visibility === 'public' ? '' : 'secondary'}
                disabled={pending}
                onClick={() => changeVisibility('public')}
              >
                For anyone
              </button>
            </div>
            {deck.visibility === 'public' ? (
              <p className="status">
                {guest
                  ? 'Anyone can open this deck after you save it to an account. Until then, it still disappears with this browser.'
                  : 'Anyone with the link can flip these cards.'}{' '}
                {guest ? null : (
                  <button type="button" className="text" onClick={copyLink}>
                    Copy link
                  </button>
                )}
              </p>
            ) : (
              <p className="status">Only you can open this deck.</p>
            )}
            {notice ? <p className="status">{notice}</p> : null}
            <Link className="account-link" to={`/study/${deck.id}`}>
              Study this deck
            </Link>
            </div>
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
            </div>
                {cards.length === 0 ? (
                  <p className="status">No cards yet.</p>
                ) : (
                  <ul className="card-list">
                    {cards.map((card) => (
                      <li key={card.id}>
                        {editingId === card.id ? (
                          <form className="index-card" onSubmit={saveCard}>
                            <label>
                              Front
                              <textarea
                                value={editFront}
                                maxLength={600}
                                required
                                onChange={(event) => setEditFront(event.target.value)}
                              />
                            </label>
                            <label>
                              Back
                              <textarea
                                value={editBack}
                                maxLength={600}
                                required
                                onChange={(event) => setEditBack(event.target.value)}
                              />
                            </label>
                            <div className="choices">
                              <button
                                type="submit"
                                disabled={
                                  pending ||
                                  editFront.trim().length === 0 ||
                                  editBack.trim().length === 0
                                }
                              >
                                Save card
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <article className="index-card">
                            <p className="card-kicker">Front</p>
                            <p className="card-face">{card.front}</p>
                            <p className="card-kicker">Back</p>
                            <p className="card-face back-face">{card.back}</p>
                            <div className="choices">
                              <button
                                type="button"
                                className="secondary"
                                disabled={pending}
                                onClick={() => {
                                  setEditingId(card.id)
                                  setEditFront(card.front)
                                  setEditBack(card.back)
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger"
                                disabled={pending}
                                onClick={() => removeCard(card)}
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
            <button type="button" className="text danger-text" disabled={pending} onClick={removeDeck}>
              Delete deck
            </button>
          </>
        ) : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  )
}
