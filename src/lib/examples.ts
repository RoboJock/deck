import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase.ts'
import { exampleMedia } from './exampleMedia.ts'
import { createGuestDeckWithCards } from './guestDecks.ts'

export type ExampleCard = {
  front: string
  back: string
  frontImage?: string
  backImage?: string
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
  {
    id: 'example-fruit',
    title: 'Market fruit',
    blurb: 'A photo on the front, the fruit’s name on the back.',
    cards: [
      { front: 'What fruit is this?', back: 'Apple', frontImage: exampleMedia.apple },
      { front: 'What fruit is this?', back: 'Lemon', frontImage: exampleMedia.lemon },
      { front: 'What fruit is this?', back: 'Strawberry', frontImage: exampleMedia.strawberry },
      { front: 'What fruit is this?', back: 'Orange', frontImage: exampleMedia.orange },
      { front: 'What fruit is this?', back: 'Grapes', frontImage: exampleMedia.grapes },
    ],
  },
  {
    id: 'example-flowers',
    title: 'Garden flowers',
    blurb: 'Photos of flowers. Name each one after you flip it.',
    cards: [
      { front: 'Name this flower', back: 'Sunflower', frontImage: exampleMedia.sunflower },
      { front: 'Name this flower', back: 'Rose', frontImage: exampleMedia.rose },
      { front: 'Name this flower', back: 'Daisy', frontImage: exampleMedia.daisy },
      { front: 'Name this flower', back: 'Tulip', frontImage: exampleMedia.tulip },
    ],
  },
  {
    id: 'example-sketches',
    title: 'Ink sketches',
    blurb: 'A drawing on the front. Say what it is.',
    cards: [
      { front: 'What is this drawing?', back: 'House', frontImage: exampleMedia.house },
      { front: 'What is this drawing?', back: 'Tree', frontImage: exampleMedia.tree },
      { front: 'What is this drawing?', back: 'Fish', frontImage: exampleMedia.fish },
      { front: 'What is this drawing?', back: 'Sun', frontImage: exampleMedia.sun },
      { front: 'What is this drawing?', back: 'Boat', frontImage: exampleMedia.boat },
    ],
  },
  {
    id: 'example-animals',
    title: 'Doodle animals',
    blurb: 'Simple ink drawings of animals.',
    cards: [
      { front: 'Which animal is this?', back: 'Cat', frontImage: exampleMedia.cat },
      { front: 'Which animal is this?', back: 'Bird', frontImage: exampleMedia.bird },
      { front: 'Which animal is this?', back: 'Rabbit', frontImage: exampleMedia.rabbit },
      { front: 'Which animal is this?', back: 'Snail', frontImage: exampleMedia.snail },
      { front: 'Which animal is this?', back: 'Butterfly', frontImage: exampleMedia.butterfly },
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
      frontImage: card.frontImage ?? '',
      backImage: card.backImage ?? '',
      order: orderBase + index,
    })
  })
  await batch.commit()
  return deckRef.id
}
