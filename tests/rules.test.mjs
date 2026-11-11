import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
let testEnv

function authed(uid) {
  return testEnv.authenticatedContext(uid).firestore()
}

function deckData(uid, extra = {}) {
  return {
    ownerId: uid,
    title: 'Shared verbs',
    visibility: 'private',
    cardCount: 0,
    createdAt: serverTimestamp(),
    ...extra,
  }
}

function cardData(uid, extra = {}) {
  return {
    ownerId: uid,
    visibility: 'private',
    front: 'hola',
    back: 'hello',
    frontImage: '',
    backImage: '',
    order: 1,
    ...extra,
  }
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-deck-share',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  })
})

after(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

test('a signed-in person can create a private deck and someone else cannot open it', async () => {
  const alice = authed('alice')
  await assertSucceeds(setDoc(doc(alice, 'decks/alice-deck'), deckData('alice')))
  await assertFails(getDoc(doc(authed('bob'), 'decks/alice-deck')))
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'decks/alice-deck')))
})

test('publishing a deck lets other people study its cards, and nobody else can edit them', async () => {
  const alice = authed('alice')
  await setDoc(doc(alice, 'decks/verbs'), deckData('alice'))
  await setDoc(doc(alice, 'decks/verbs/cards/one'), cardData('alice'))
  await setDoc(doc(alice, 'decks/verbs/cards/two'), cardData('alice', { front: 'adios', back: 'bye', order: 2 }))
  await updateDoc(doc(alice, 'decks/verbs'), { cardCount: 2 })

  await updateDoc(doc(alice, 'decks/verbs'), { visibility: 'public' })
  await updateDoc(doc(alice, 'decks/verbs/cards/one'), { visibility: 'public' })
  await updateDoc(doc(alice, 'decks/verbs/cards/two'), { visibility: 'public' })

  const stranger = testEnv.unauthenticatedContext().firestore()
  const deck = await getDoc(doc(stranger, 'decks/verbs'))
  assert.equal(deck.data().title, 'Shared verbs')
  const cards = await getDocs(query(collection(stranger, 'decks/verbs/cards'), where('visibility', '==', 'public')))
  assert.deepEqual(cards.docs.map((item) => item.data().front).sort(), ['adios', 'hola'])

  const bob = authed('bob')
  await assertFails(updateDoc(doc(bob, 'decks/verbs'), { title: 'Taken over' }))
  await assertFails(updateDoc(doc(bob, 'decks/verbs/cards/one'), { back: 'changed' }))
  await assertFails(setDoc(doc(bob, 'decks/verbs/cards/sneaky'), cardData('bob', { visibility: 'public' })))
  await assertFails(deleteDoc(doc(bob, 'decks/verbs')))
})

test('making a deck private again hides it from the previous link', async () => {
  const alice = authed('alice')
  await setDoc(doc(alice, 'decks/secret'), deckData('alice', { visibility: 'public' }))
  await setDoc(doc(alice, 'decks/secret/cards/one'), cardData('alice', { visibility: 'public' }))
  await updateDoc(doc(alice, 'decks/secret/cards/one'), { visibility: 'private' })
  await updateDoc(doc(alice, 'decks/secret'), { visibility: 'private' })
  await assertFails(getDoc(doc(authed('bob'), 'decks/secret')))
  await assertFails(getDoc(doc(authed('bob'), 'decks/secret/cards/one')))
})

test('many people can publish decks and a visitor can list only the public ones', async () => {
  const people = 24
  await Promise.all(
    Array.from({ length: people }, async (_, index) => {
      const uid = `person-${index}`
      const db = authed(uid)
      const visibility = index % 3 === 0 ? 'private' : 'public'
      await setDoc(doc(db, `decks/deck-${index}`), deckData(uid, { title: `Deck ${index}`, visibility }))
      await setDoc(
        doc(db, `decks/deck-${index}/cards/card`),
        cardData(uid, { visibility, front: `front ${index}`, back: `back ${index}` }),
      )
    }),
  )

  const visitor = testEnv.unauthenticatedContext().firestore()
  const listed = await getDocs(query(collection(visitor, 'decks'), where('visibility', '==', 'public')))
  assert.equal(listed.size, 16)
  await assertFails(getDocs(collection(visitor, 'decks')))

  const sample = await getDocs(query(collection(visitor, 'decks/deck-1/cards'), where('visibility', '==', 'public')))
  assert.equal(sample.docs[0].data().front, 'front 1')
  const hiddenCards = await getDocs(
    query(collection(visitor, 'decks/deck-0/cards'), where('visibility', '==', 'public')),
  )
  assert.equal(hiddenCards.size, 0)
  await assertFails(getDoc(doc(visitor, 'decks/deck-0')))
  await assertFails(getDoc(doc(visitor, 'decks/deck-0/cards/card')))
})

test('each person only sees and writes their own study progress', async () => {
  const alice = authed('alice')
  await assertSucceeds(
    setDoc(doc(alice, 'users/alice/progress/card-1'), {
      deckId: 'verbs',
      deckTitle: 'Shared verbs',
      rating: 'again',
      seenAt: Date.now(),
      front: 'hola',
      back: 'hello',
      frontImage: '',
      backImage: '',
    }),
  )
  await assertFails(getDoc(doc(authed('bob'), 'users/alice/progress/card-1')))
  await assertFails(
    setDoc(doc(authed('bob'), 'users/alice/progress/card-1'), {
      deckId: 'verbs',
      deckTitle: 'Shared verbs',
      rating: 'got',
      seenAt: 1,
      front: 'hola',
      back: 'hello',
      frontImage: '',
      backImage: '',
    }),
  )
})

test('decks and cards reject unsigned people, fake owners, and oversized text', async () => {
  const outsider = testEnv.unauthenticatedContext().firestore()
  await assertFails(setDoc(doc(outsider, 'decks/nope'), deckData('alice')))
  await assertFails(setDoc(doc(authed('alice'), 'decks/stolen'), deckData('bob')))
  await assertFails(setDoc(doc(authed('alice'), 'decks/long'), deckData('alice', { title: 'x'.repeat(101) })))
  await assertSucceeds(setDoc(doc(authed('alice'), 'decks/ok'), deckData('alice', { title: 'x'.repeat(100) })))
  await assertFails(
    setDoc(doc(authed('alice'), 'decks/ok/cards/big'), cardData('alice', { front: 'y'.repeat(601) })),
  )
  await assertSucceeds(
    setDoc(doc(authed('alice'), 'decks/ok/cards/picture'), cardData('alice', { front: '', frontImage: 'abc' })),
  )
})

test('the owner can remove cards and then the deck', async () => {
  const alice = authed('alice')
  await setDoc(doc(alice, 'decks/gone'), deckData('alice', { visibility: 'public' }))
  await setDoc(doc(alice, 'decks/gone/cards/one'), cardData('alice', { visibility: 'public' }))
  await assertSucceeds(deleteDoc(doc(alice, 'decks/gone/cards/one')))
  await assertSucceeds(deleteDoc(doc(alice, 'decks/gone')))
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'decks/gone')))
})
