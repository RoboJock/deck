import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Header } from '../components/Header.tsx'
import { FirebaseError } from 'firebase/app'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { explain } from '../lib/errors.ts'
import { useAuth } from '../useAuth.ts'
import { StudyCards } from '../components/StudyCards.tsx'
import type { CardRecord, Visibility } from '../types.ts'

type PublicDeck = {
  title: string
  ownerId: string
}

export function PublicDeckPage() {
  const { deckId = '' } = useParams()
  const { user } = useAuth()
  const [deck, setDeck] = useState<PublicDeck | null>(null)
  const [cards, setCards] = useState<CardRecord[]>([])
  const [message, setMessage] = useState('Loading deck…')
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    return onSnapshot(
      doc(db, 'decks', deckId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setDeck(null)
          setBlocked(true)
          setMessage('This deck does not exist.')
          return
        }
        const data = snapshot.data()
        setDeck({
          title: String(data.title ?? 'Deck'),
          ownerId: String(data.ownerId ?? ''),
        })
        setBlocked(false)
      },
      (caught) => {
        setDeck(null)
        setBlocked(true)
        setMessage(
          caught instanceof FirebaseError && caught.code === 'permission-denied'
            ? 'This deck is private.'
            : explain(caught),
        )
      },
    )
  }, [deckId])

  useEffect(() => {
    if (!deck) return
    const cardsQuery = query(
      collection(db, 'decks', deckId, 'cards'),
      where('visibility', '==', 'public'),
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
      (caught) => setMessage(explain(caught)),
    )
  }, [deck, deckId])

  const ownsDeck = user && deck && user.uid === deck.ownerId

  return (
    <div className="frame">
      <Header />
      <main className="wrap">
        {ownsDeck ? (
          <p className="status">
            <Link className="text" to={`/decks/${deckId}`}>
              Edit this deck
            </Link>
          </p>
        ) : null}
        {blocked || !deck ? (
          <>
            <h1>Deck</h1>
            <p className="status">{message}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">Public deck</p>
            <h1>{deck.title}</h1>
            <StudyCards cards={cards} />
          </>
        )}
      </main>
    </div>
  )
}
