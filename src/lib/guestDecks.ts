import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase.ts'
import type { Orientation, Visibility } from '../types.ts'

const STORAGE_KEY = 'deck.guest.v1'

export type GuestCard = {
  id: string
  front: string
  back: string
  frontImage: string
  backImage: string
  order: number
}

export type GuestDeck = {
  id: string
  title: string
  visibility: Visibility
  orientation: Orientation
  createdAt: number
  cards: GuestCard[]
}

const listeners = new Set<() => void>()

function read(): GuestDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as GuestDeck[]).map((deck) => ({
      ...deck,
      orientation: deck.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      cards: (deck.cards ?? []).map((card) => ({
        ...card,
        frontImage: card.frontImage || '',
        backImage: card.backImage || '',
      })),
    }))
  } catch {
    return []
  }
}

function write(decks: GuestDeck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
  listeners.forEach((listener) => listener())
}

export function isGuestDeckId(id: string): boolean {
  return id.startsWith('guest-')
}

export function listGuestDecks(): GuestDeck[] {
  return read().sort((a, b) => b.createdAt - a.createdAt)
}

export function getGuestDeck(id: string): GuestDeck | null {
  return read().find((deck) => deck.id === id) ?? null
}

export function subscribeGuestDecks(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function createGuestDeck(title: string): GuestDeck {
  return createGuestDeckWithCards(title, [])
}

export function createGuestDeckWithCards(
  title: string,
  cards: Array<Pick<GuestCard, 'front' | 'back'>>,
): GuestDeck {
  const createdAt = Date.now()
  const deck: GuestDeck = {
    id: `guest-${crypto.randomUUID()}`,
    title,
    visibility: 'private',
    createdAt,
    orientation: 'vertical',
    cards: cards.map((card, index) => ({
      id: `card-${crypto.randomUUID()}`,
      front: card.front,
      back: card.back,
      frontImage: '',
      backImage: '',
      order: createdAt + index,
    })),
  }
  write([deck, ...read()])
  return deck
}

export function updateGuestDeck(
  id: string,
  patch: Partial<Pick<GuestDeck, 'title' | 'visibility' | 'orientation'>>,
): void {
  write(read().map((deck) => (deck.id === id ? { ...deck, ...patch } : deck)))
}

export function addGuestCard(
  deckId: string,
  front: string,
  back: string,
  frontImage = '',
  backImage = '',
): void {
  write(
    read().map((deck) => {
      if (deck.id !== deckId) return deck
      return {
        ...deck,
        cards: [
          ...deck.cards,
          {
            id: `card-${crypto.randomUUID()}`,
            front,
            back,
            frontImage,
            backImage,
            order: Date.now(),
          },
        ],
      }
    }),
  )
}

export function updateGuestCard(
  deckId: string,
  cardId: string,
  front: string,
  back: string,
  frontImage = '',
  backImage = '',
): void {
  write(
    read().map((deck) => {
      if (deck.id !== deckId) return deck
      return {
        ...deck,
        cards: deck.cards.map((card) =>
          card.id === cardId ? { ...card, front, back, frontImage, backImage } : card,
        ),
      }
    }),
  )
}

export function deleteGuestCard(deckId: string, cardId: string): void {
  write(
    read().map((deck) => {
      if (deck.id !== deckId) return deck
      return { ...deck, cards: deck.cards.filter((card) => card.id !== cardId) }
    }),
  )
}

export function deleteGuestDeck(id: string): void {
  write(read().filter((deck) => deck.id !== id))
}

let migration: Promise<number> | null = null

export function migrateGuestDecks(uid: string): Promise<number> {
  if (migration) return migration
  const decks = listGuestDecks()
  if (decks.length === 0) return Promise.resolve(0)

  migration = (async () => {
    let saved = 0
    for (const deck of decks) {
      const deckRef = await addDoc(collection(db, 'decks'), {
        ownerId: uid,
        title: deck.title,
        visibility: deck.visibility,
        orientation: deck.orientation === 'horizontal' ? 'horizontal' : 'vertical',
        cardCount: 0,
        createdAt: serverTimestamp(),
      })

      const chunkSize = 400
      for (let index = 0; index < deck.cards.length; index += chunkSize) {
        const batch = writeBatch(db)
        for (const card of deck.cards.slice(index, index + chunkSize)) {
          const cardRef = doc(collection(db, 'decks', deckRef.id, 'cards'))
          batch.set(cardRef, {
            ownerId: uid,
            visibility: deck.visibility,
            front: card.front,
            back: card.back,
            frontImage: card.frontImage || '',
            backImage: card.backImage || '',
            order: card.order,
          })
        }
        await batch.commit()
      }

      if (deck.cards.length > 0) {
        await updateDoc(deckRef, { cardCount: deck.cards.length })
      }
      deleteGuestDeck(deck.id)
      saved += 1
    }
    return saved
  })().finally(() => {
    migration = null
  })

  return migration
}
