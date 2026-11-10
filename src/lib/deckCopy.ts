import { addDoc, collection, doc, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase.ts'
import { createGuestDeckWithCards, updateGuestDeck } from './guestDecks.ts'
import type { ImportedCard } from './cardFile.ts'
import type { Orientation, Visibility } from '../types.ts'

type CopyCard = {
  front: string
  back: string
  frontImage?: string
  backImage?: string
}

export async function duplicateDeck(
  source: {
    title: string
    orientation: Orientation
    cards: CopyCard[]
  },
  uid: string | null,
): Promise<string> {
  const title = `${source.title.slice(0, 94)} copy`.trim()
  if (!uid) {
    const deck = createGuestDeckWithCards(title, source.cards)
    if (source.orientation === 'horizontal') updateGuestDeck(deck.id, { orientation: 'horizontal' })
    return deck.id
  }

  const deckRef = await addDoc(collection(db, 'decks'), {
    ownerId: uid,
    title,
    visibility: 'private' satisfies Visibility,
    orientation: source.orientation,
    cardCount: 0,
    createdAt: serverTimestamp(),
  })
  await writeCards(deckRef.id, uid, 'private', source.cards)
  if (source.cards.length > 0) await updateDoc(deckRef, { cardCount: source.cards.length })
  return deckRef.id
}

export async function importCards(
  deckId: string,
  uid: string,
  visibility: Visibility,
  cards: ImportedCard[],
) {
  await writeCards(deckId, uid, visibility, cards)
  if (cards.length > 0) {
    await updateDoc(doc(db, 'decks', deckId), { cardCount: increment(cards.length) })
  }
}

async function writeCards(
  deckId: string,
  uid: string,
  visibility: Visibility,
  cards: CopyCard[],
) {
  const orderBase = Date.now()
  const chunkSize = 400
  for (let index = 0; index < cards.length; index += chunkSize) {
    const batch = writeBatch(db)
    cards.slice(index, index + chunkSize).forEach((card, offset) => {
      const cardRef = doc(collection(db, 'decks', deckId, 'cards'))
      batch.set(cardRef, {
        ownerId: uid,
        visibility,
        front: card.front,
        back: card.back,
        frontImage: card.frontImage || '',
        backImage: card.backImage || '',
        order: orderBase + index + offset,
      })
    })
    await batch.commit()
  }
}
