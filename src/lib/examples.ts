import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase.ts'
import { createGuestDeckWithCards } from './guestDecks.ts'

export type ExampleCard = {
  front: string
  back: string
}

export type ExampleDeck = {
  id: string
  title: string
  blurb: string
  cards: ExampleCard[]
}

export const examples: ExampleDeck[] = [
  {
    id: 'example-spanish',
    title: 'Spanish verbs',
    blurb: 'A short deck of verbs you can flip through in a minute.',
    cards: [
      { front: 'ser', back: 'to be, for something lasting' },
      { front: 'estar', back: 'to be, for a state or place' },
      { front: 'tener', back: 'to have' },
      { front: 'ir', back: 'to go' },
      { front: 'hacer', back: 'to do or to make' },
    ],
  },
  {
    id: 'example-capitals',
    title: 'World capitals',
    blurb: 'Country on the front, capital on the back.',
    cards: [
      { front: 'Japan', back: 'Tokyo' },
      { front: 'Canada', back: 'Ottawa' },
      { front: 'Kenya', back: 'Nairobi' },
      { front: 'Brazil', back: 'Brasília' },
      { front: 'Australia', back: 'Canberra' },
    ],
  },
  {
    id: 'example-kitchen',
    title: 'Kitchen measures',
    blurb: 'Conversions that are easy to forget while cooking.',
    cards: [
      { front: '1 tablespoon', back: '3 teaspoons' },
      { front: '1 cup', back: '16 tablespoons' },
      { front: '1 stick of butter', back: '8 tablespoons, or 1/2 cup' },
      { front: '350°F', back: '175°C' },
      { front: 'a pinch', back: 'less than 1/8 teaspoon' },
    ],
  },
  {
    id: 'example-git',
    title: 'Git commands',
    blurb: 'The commands you use most when saving work.',
    cards: [
      { front: 'git status', back: 'Show what changed' },
      { front: 'git add .', back: 'Stage every change' },
      { front: 'git commit -m "message"', back: 'Save a snapshot with a note' },
      { front: 'git push', back: 'Upload commits to the remote' },
      { front: 'git pull', back: 'Download commits from the remote' },
    ],
  },
]

export function isExampleDeckId(id: string): boolean {
  return examples.some((deck) => deck.id === id)
}

export function getExampleDeck(id: string): ExampleDeck | null {
  return examples.find((deck) => deck.id === id) ?? null
}

export async function copyExampleDeck(example: ExampleDeck, uid: string | null): Promise<string> {
  if (!uid) {
    return createGuestDeckWithCards(example.title, example.cards).id
  }

  const deckRef = await addDoc(collection(db, 'decks'), {
    ownerId: uid,
    title: example.title,
    visibility: 'private',
    cardCount: example.cards.length,
    createdAt: serverTimestamp(),
  })
  const batch = writeBatch(db)
  const orderBase = Date.now()
  example.cards.forEach((card, index) => {
    const cardRef = doc(collection(db, 'decks', deckRef.id, 'cards'))
    batch.set(cardRef, {
      ownerId: uid,
      visibility: 'private',
      front: card.front,
      back: card.back,
      order: orderBase + index,
    })
  })
  await batch.commit()
  return deckRef.id
}
