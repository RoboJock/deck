import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { getExampleDeck, isExampleDeckId } from '../lib/examples.ts'
import { getGuestDeck, isGuestDeckId, subscribeGuestDecks } from '../lib/guestDecks.ts'
import { shuffle } from '../lib/shuffle.ts'
import { useAuth } from '../useAuth.ts'
import type { CardRecord, Visibility } from '../types.ts'

type Rating = 'got' | 'unsure' | 'again'

export function StudyPage() {
  const { deckId = '' } = useParams()
  const { user } = useAuth()
  const guest = isGuestDeckId(deckId)
  const example = isExampleDeckId(deckId)
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [cards, setCards] = useState<CardRecord[]>([])
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [ratings, setRatings] = useState<Record<string, Rating>>({})
  const [roundIds, setRoundIds] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [sessionDeck, setSessionDeck] = useState<string | null>(null)
  const started = useRef(false)

  if (sessionDeck !== deckId) {
    setSessionDeck(deckId)
    setOwnerId('')
    setIndex(0)
    setFlipped(false)
    setRevealed(false)
    setRatings({})
    setDone(false)
    const found = example ? getExampleDeck(deckId) : null
    if (found) {
      const next = found.cards.map((card, index) => ({
        id: `${found.id}-${index}`,
        ownerId: '',
        visibility: 'public' as const,
        front: card.front,
        back: card.back,
        order: index,
      }))
      const order = shuffle(next.map((card) => card.id))
      setTitle(found.title)
      setMessage(null)
      setCards(next)
      setQueue(order)
      setRoundIds(order)
      setReady(true)
    } else if (example) {
      setTitle('')
      setMessage('This deck does not exist.')
      setCards([])
      setQueue([])
      setRoundIds([])
      setReady(true)
    } else {
      setTitle('')
      setMessage(null)
      setCards([])
      setQueue([])
      setRoundIds([])
      setReady(false)
    }
  }

  function begin(ids: string[], keepRatings: boolean) {
    const order = shuffle(ids)
    setQueue(order)
    setRoundIds(order)
    setIndex(0)
    setFlipped(false)
    setRevealed(false)
    setDone(order.length === 0)
    if (!keepRatings) setRatings({})
  }

  function takeCards(next: CardRecord[]) {
    setCards(next)
    if (!started.current && next.length > 0) {
      started.current = true
      begin(next.map((card) => card.id), false)
    }
  }

  useEffect(() => {
    started.current = false
  }, [deckId])

  useEffect(() => {
    if (!guest) return
    const pull = () => {
      const found = getGuestDeck(deckId)
      if (!found) {
        setMessage('This deck no longer exists.')
        setCards([])
        setReady(true)
        return
      }
      setTitle(found.title)
      setOwnerId('')
      setMessage(null)
      takeCards(
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
      setReady(true)
    }
    pull()
    return subscribeGuestDecks(pull)
  }, [deckId, guest])

  useEffect(() => {
    if (guest || example) return
    return onSnapshot(
      doc(db, 'decks', deckId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setMessage('This deck does not exist.')
          setReady(true)
          return
        }
        const data = snapshot.data()
        setTitle(String(data.title ?? 'Deck'))
        setOwnerId(String(data.ownerId ?? ''))
        setMessage(null)
        setReady(true)
      },
      (caught) => {
        setReady(true)
        setMessage(
          caught instanceof FirebaseError && caught.code === 'permission-denied'
            ? 'This deck is private.'
            : explain(caught),
        )
      },
    )
  }, [deckId, example, guest])

  useEffect(() => {
    if (guest || example || !ready || message) return
    const mine = user && user.uid === ownerId
    const cardsQuery = mine
      ? query(collection(db, 'decks', deckId, 'cards'), where('ownerId', '==', user.uid))
      : query(collection(db, 'decks', deckId, 'cards'), where('visibility', '==', 'public'))
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
        takeCards(next)
      },
      (caught) => setMessage(explain(caught)),
    )
  }, [deckId, example, guest, message, ownerId, ready, user])

  function showCard(cardId: string) {
    return cards.find((card) => card.id === cardId)
  }

  function rate(value: Rating) {
    const cardId = queue[index]
    if (!cardId) return
    const nextRatings = { ...ratings, [cardId]: value }
    setRatings(nextRatings)
    if (index + 1 >= queue.length) {
      setDone(true)
      return
    }
    setIndex(index + 1)
    setFlipped(false)
    setRevealed(false)
  }

  function count(value: Rating) {
    return roundIds.filter((id) => ratings[id] === value).length
  }

  const card = showCard(queue[index] ?? '')
  const againIds = roundIds.filter((id) => ratings[id] !== 'got' && showCard(id))

  return (
    <main className="study-screen">
      {message ? (
        <>
          <h1>Study</h1>
          <p className="status">{message}</p>
        </>
      ) : null}
      {!message && ready && cards.length === 0 ? (
        <>
          <h1>{title || 'Study'}</h1>
          <p className="status">This deck has no cards yet.</p>
        </>
      ) : null}
      {!message && done ? (
        <div className="study-done">
          <p className="eyebrow">Finished</p>
          <h1>{title}</h1>
          <p className="lede">
            Got it {count('got')} · Not sure {count('unsure')} · Study again {count('again')}
          </p>
          {againIds.length > 0 ? (
            <button type="button" onClick={() => begin(againIds, true)}>
              Study again without cards you got
            </button>
          ) : (
            <p className="status">Every card in this pass was marked Got it.</p>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => begin(cards.map((item) => item.id), false)}
          >
            Study every card again
          </button>
          <p className="status">
            Skipping cards you got is temporary. Those cards stay in the deck and come back when
            you study every card.
          </p>
        </div>
      ) : null}
      {!message && !done && card ? (
        <>
          <p className="status">
            {title} · {index + 1} of {queue.length}
          </p>
          <button
            type="button"
            className={`study-card${flipped ? ' is-back' : ' is-front'}`}
            aria-label={`${flipped ? 'Back' : 'Front'} of the card. Click to flip.`}
            onClick={() => {
              setFlipped((current) => !current)
              setRevealed(true)
            }}
          >
            <span className="card-kicker">{flipped ? 'Back' : 'Front'}</span>
            <span className="study-text">{flipped ? card.back : card.front}</span>
          </button>
          {revealed ? (
            <div className="rate-row">
              <button type="button" className="rate-got" onClick={() => rate('got')}>
                Got it
              </button>
              <button type="button" className="rate-unsure" onClick={() => rate('unsure')}>
                Not sure
              </button>
              <button type="button" className="rate-again" onClick={() => rate('again')}>
                Study again
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
