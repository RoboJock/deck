import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from './firebase.ts'

export type Rating = 'got' | 'unsure' | 'again'

export type ProgressMark = {
  cardId: string
  deckId: string
  deckTitle: string
  rating: Rating
  seenAt: number
  front: string
  back: string
  frontImage: string
  backImage: string
}

const KEY = 'deck.progress.v1'

function readLocal(): Record<string, ProgressMark> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, ProgressMark>
  } catch {
    return {}
  }
}

function writeLocal(all: Record<string, ProgressMark>) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function listLocalProgress(): ProgressMark[] {
  return Object.values(readLocal())
}

function clipText(text: string, max: number) {
  return text.slice(0, max)
}

export function storedMark(mark: ProgressMark): ProgressMark {
  return {
    ...mark,
    deckTitle: clipText(mark.deckTitle, 100),
    front: clipText(mark.front, 600),
    back: clipText(mark.back, 600),
    frontImage: mark.frontImage.length <= 180000 ? mark.frontImage : '',
    backImage: mark.backImage.length <= 180000 ? mark.backImage : '',
  }
}

function asRating(value: unknown): Rating {
  return value === 'unsure' || value === 'again' ? value : 'got'
}

export function retargetLocalProgress(oldId: string, newId: string, deckId: string) {
  const all = readLocal()
  const mark = all[oldId]
  if (!mark) return
  delete all[oldId]
  all[newId] = { ...mark, cardId: newId, deckId }
  writeLocal(all)
}

export async function saveProgress(uid: string | null, mark: ProgressMark) {
  const stored = storedMark(mark)
  if (!uid) {
    const all = readLocal()
    all[stored.cardId] = stored
    writeLocal(all)
    return
  }
  await setDoc(doc(db, 'users', uid, 'progress', stored.cardId), {
    deckId: stored.deckId,
    deckTitle: stored.deckTitle,
    rating: stored.rating,
    seenAt: stored.seenAt,
    front: stored.front,
    back: stored.back,
    frontImage: stored.frontImage,
    backImage: stored.backImage,
  })
}

export async function removeProgress(uid: string | null, cardId: string) {
  if (!uid) {
    const all = readLocal()
    delete all[cardId]
    writeLocal(all)
    return
  }
  await deleteDoc(doc(db, 'users', uid, 'progress', cardId))
}

export async function listProgress(uid: string | null): Promise<ProgressMark[]> {
  if (!uid) return listLocalProgress()
  const snap = await getDocs(collection(db, 'users', uid, 'progress'))
  return snap.docs.map((item) => {
    const data = item.data()
    return {
      cardId: item.id,
      deckId: String(data.deckId ?? ''),
      deckTitle: String(data.deckTitle ?? ''),
      rating: asRating(data.rating),
      seenAt: Number(data.seenAt ?? 0),
      front: String(data.front ?? ''),
      back: String(data.back ?? ''),
      frontImage: String(data.frontImage ?? ''),
      backImage: String(data.backImage ?? ''),
    }
  })
}

export async function marksForCards(uid: string | null, cardIds: string[]) {
  const wanted = new Set(cardIds)
  const marks: Record<string, ProgressMark> = {}
  for (const mark of await listProgress(uid)) {
    if (wanted.has(mark.cardId)) marks[mark.cardId] = mark
  }
  return marks
}

export async function uploadLocalProgress(uid: string) {
  const local = listLocalProgress()
  for (const mark of local) {
    await saveProgress(uid, mark)
  }
  if (local.length > 0) localStorage.removeItem(KEY)
}
