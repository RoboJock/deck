import type { DocumentReference, Timestamp } from 'firebase/firestore'

export type Visibility = 'public' | 'private'

export type DeckRecord = {
  id: string
  ownerId: string
  title: string
  visibility: Visibility
  cardCount: number
  createdAt: Timestamp | null
}

export type CardRecord = {
  id: string
  ref?: DocumentReference
  ownerId: string
  visibility: Visibility
  front: string
  back: string
  order: number
}
