import type { DocumentReference, Timestamp } from 'firebase/firestore'

export type Visibility = 'public' | 'private'
export type Orientation = 'vertical' | 'horizontal'

export type DeckRecord = {
  id: string
  ownerId: string
  title: string
  visibility: Visibility
  orientation: Orientation
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
  frontImage: string
  backImage: string
  order: number
}
