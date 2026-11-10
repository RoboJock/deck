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
import { CardComposer } from '../components/CardComposer.tsx'
import { UnsavedNotice } from '../components/UnsavedNotice.tsx'
import type { CardRecord, DeckRecord, Orientation, Visibility } from '../types.ts'

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
  const [frontImage, setFrontImage] = useState('')
  const [backImage, setBackImage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editFrontImage, setEditFrontImage] = useState('')
  const [editBackImage, setEditBackImage] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        orientation: found.orientation === 'horizontal' ? 'horizontal' : 'vertical',
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
            frontImage: card.frontImage || '',
            backImage: card.backImage || '',
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
          orientation: data.orientation === 'horizontal' ? 'horizontal' : 'vertical',
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
            frontImage: String(data.frontImage ?? ''),
            backImage: String(data.backImage ?? ''),
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

  async function changeOrientation(next: Orientation) {
    if (!deck || next === deck.orientation) return
    setPending(true)
    setError(null)
    try {
      if (guest) updateGuestDeck(deck.id, { orientation: next })
      else await updateDoc(doc(db, 'decks', deck.id), { orientation: next })
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setPending(false)
    }
  }

  function cardPayload(textFront: string, textBack: string, imageFront: string, imageBack: string) {
    return {
      front: textFront,
      back: textBack,
      frontImage: imageFront,
      backImage: imageBack,
    }
  }

  async function addCard(event: FormEvent) {
    event.preventDefault()
    if (!deck) return
    const trimmedFront = front.trim()
    const trimmedBack = back.trim()
    if ((!trimmedFront && !frontImage) || (!trimmedBack && !backImage)) return
    setPending(true)
    setError(null)
    try {
      if (guest) {
        addGuestCard(deck.id, trimmedFront, trimmedBack, frontImage, backImage)
      } else if (user) {
        const cardRef = doc(collection(db, 'decks', deck.id, 'cards'))
        const batch = writeBatch(db)
        batch.set(cardRef, {
          ownerId: user.uid,
          visibility: deck.visibility,
          ...cardPayload(trimmedFront, trimmedBack, frontImage, backImage),
          order: Date.now(),
        })
        batch.update(doc(db, 'decks', deck.id), { cardCount: increment(1) })
        await batch.commit()
      }
      setFront('')
      setBack('')
      setFrontImage('')
      setBackImage('')
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
    if (!deck || !card) return
    if ((!trimmedFront && !editFrontImage) || (!trimmedBack && !editBackImage)) return
    setPending(true)
    setError(null)
    try {
      const payload = cardPayload(trimmedFront, trimmedBack, editFrontImage, editBackImage)
      if (guest) updateGuestCard(deck.id, card.id, payload.front, payload.back, payload.frontImage, payload.backImage)
      else if (card.ref) await updateDoc(card.ref, payload)
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

  const needsSignIn = ready && !user && !guest

  return (
    <div className="frame">
      <main className="wrap">
        {needsSignIn ? (
          <>
            <h1>Sign in to open this deck</h1>
            <p className="lede">Saved decks belong to an account.</p>
            <Link className="account-link" to="/account?mode=sign-in">
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
            <form className="stack title-form" onSubmit={saveTitle}>
              <label>
                Title
                <input
                  value={title}
                  maxLength={100}
                  style={{ width: `${Math.min(36, Math.max(title.trim().length + 1, 12))}ch` }}
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
            <div className="option-group">
              <p className="option-label">Who can view this deck:</p>
              <div className="pair">
                <button
                  type="button"
                  className={deck.visibility === 'private' ? '' : 'secondary'}
                  disabled={pending}
                  onClick={() => changeVisibility('private')}
                >
                  Me
                </button>
                <button
                  type="button"
                  className={deck.visibility === 'public' ? '' : 'secondary'}
                  disabled={pending}
                  onClick={() => changeVisibility('public')}
                >
                  Anyone
                </button>
              </div>
            </div>
            <div className="option-group">
              <p className="option-label">Card view:</p>
              <div className="pair">
                <button
                  type="button"
                  className={deck.orientation === 'vertical' ? '' : 'secondary'}
                  disabled={pending}
                  onClick={() => changeOrientation('vertical')}
                >
                  Vertical
                </button>
                <button
                  type="button"
                  className={deck.orientation === 'horizontal' ? '' : 'secondary'}
                  disabled={pending}
                  onClick={() => changeOrientation('horizontal')}
                >
                  Horizontal
                </button>
              </div>
            </div>
            <div className="study-actions">
              <div className="pair">
                <Link className="account-link" to={`/study/${deck.id}`}>
                  Study this deck
                </Link>
                <button
                  type="button"
                  className="danger-fill"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete deck
                </button>
              </div>
              {confirmingDelete ? (
                <div className="confirm" role="alertdialog" aria-label={`Delete ${deck.title}`}>
                  <p>Delete “{deck.title}” and all of its cards?</p>
                  <div className="pair">
                    <button type="button" className="danger-fill" disabled={pending} onClick={removeDeck}>
                      Delete {deck.title}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Keep {deck.title}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            </div>
            <CardComposer
              front={{ text: front, image: frontImage }}
              back={{ text: back, image: backImage }}
              pending={pending}
              submitLabel="Add card"
              onFront={(face) => {
                setFront(face.text)
                setFrontImage(face.image)
              }}
              onBack={(face) => {
                setBack(face.text)
                setBackImage(face.image)
              }}
              onSubmit={addCard}
            />
            </div>
                {cards.length === 0 ? (
                  <p className="status">No cards yet.</p>
                ) : (
                  <ul className={`card-list is-${deck.orientation}`}>
                    {cards.map((card) => (
                      <li key={card.id}>
                        {editingId === card.id ? (
                          <CardComposer
                            front={{ text: editFront, image: editFrontImage }}
                            back={{ text: editBack, image: editBackImage }}
                            pending={pending}
                            submitLabel="Save card"
                            onFront={(face) => {
                              setEditFront(face.text)
                              setEditFrontImage(face.image)
                            }}
                            onBack={(face) => {
                              setEditBack(face.text)
                              setEditBackImage(face.image)
                            }}
                            onSubmit={saveCard}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <article className={`index-card is-${deck.orientation}`}>
                            <p className="card-kicker">Front</p>
                            {card.frontImage ? <img className="card-photo" alt="" src={card.frontImage} /> : null}
                            {card.front ? <p className="card-face face-front">{card.front}</p> : null}
                            <p className="card-kicker back-kicker">Back</p>
                            {card.backImage ? <img className="card-photo" alt="" src={card.backImage} /> : null}
                            {card.back ? <p className="card-face">{card.back}</p> : null}
                            <div className="pair">
                              <button
                                type="button"
                                className="secondary"
                                disabled={pending}
                                onClick={() => {
                                  setEditingId(card.id)
                                  setEditFront(card.front)
                                  setEditBack(card.back)
                                  setEditFrontImage(card.frontImage)
                                  setEditBackImage(card.backImage)
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
