import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase.ts'
import { listGuestDecks } from './guestDecks.ts'
import { listProgress, type ProgressMark } from './progress.ts'

export type PileCard = {
  id: string
  deckId: string
  deckTitle: string
  front: string
  back: string
  frontImage: string
  backImage: string
}

const threeDays = 3 * 24 * 60 * 60 * 1000
const few = 5

export function buildDailyPile(marks: ProgressMark[], unseen: PileCard[], now = Date.now()): PileCard[] {
  const again = marks.filter((mark) => mark.rating === 'again')
  const stale = marks
    .filter((mark) => mark.rating !== 'again' && now - mark.seenAt >= threeDays)
    .sort((a, b) => a.seenAt - b.seenAt)
    .slice(0, few)
  const known = new Set(marks.map((mark) => mark.cardId))
  const fresh = unseen.filter((card) => !known.has(card.id)).slice(0, few)
  const seen = new Set<string>()
  const pile: PileCard[] = []
  for (const card of [...again.map(markToCard), ...stale.map(markToCard), ...fresh]) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    pile.push(card)
  }
  return pile
}

function markToCard(mark: ProgressMark): PileCard {
  return {
    id: mark.cardId,
    deckId: mark.deckId,
    deckTitle: mark.deckTitle,
    front: mark.front,
    back: mark.back,
    frontImage: mark.frontImage,
    backImage: mark.backImage,
  }
}

async function unseenCards(uid: string | null, marks: ProgressMark[]): Promise<PileCard[]> {
  const known = new Set(marks.map((mark) => mark.cardId))
  const unseen: PileCard[] = []
  if (!uid) {
    for (const deck of listGuestDecks()) {
      for (const card of deck.cards) {
        if (known.has(card.id)) continue
        unseen.push({
          id: card.id,
          deckId: deck.id,
          deckTitle: deck.title,
          front: card.front,
          back: card.back,
          frontImage: card.frontImage,
          backImage: card.backImage,
        })
        if (unseen.length >= few) return unseen
      }
    }
    return unseen
  }

  const decksSnap = await getDocs(query(collection(db, 'decks'), where('ownerId', '==', uid)))
  for (const deckDoc of decksSnap.docs) {
    if (unseen.length >= few) break
    const title = String(deckDoc.data().title ?? '')
    const cardsSnap = await getDocs(collection(db, 'decks', deckDoc.id, 'cards'))
    for (const cardDoc of cardsSnap.docs) {
      if (known.has(cardDoc.id)) continue
      const data = cardDoc.data()
      unseen.push({
        id: cardDoc.id,
        deckId: deckDoc.id,
        deckTitle: title,
        front: String(data.front ?? ''),
        back: String(data.back ?? ''),
        frontImage: String(data.frontImage ?? ''),
        backImage: String(data.backImage ?? ''),
      })
      if (unseen.length >= few) break
    }
  }
  return unseen
}

export async function loadDailyPile(uid: string | null): Promise<PileCard[]> {
  const marks = await listProgress(uid)
  const unseen = await unseenCards(uid, marks)
  return buildDailyPile(marks, unseen)
}
