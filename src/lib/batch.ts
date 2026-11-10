import {
  writeBatch,
  type DocumentReference,
  type UpdateData,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase.ts'

const chunkSize = 400

export async function updateEach(
  refs: DocumentReference[],
  data: UpdateData<DocumentData>,
): Promise<void> {
  for (let index = 0; index < refs.length; index += chunkSize) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(index, index + chunkSize)) {
      batch.update(ref, data)
    }
    await batch.commit()
  }
}

export async function deleteEach(refs: DocumentReference[]): Promise<void> {
  for (let index = 0; index < refs.length; index += chunkSize) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(index, index + chunkSize)) {
      batch.delete(ref)
    }
    await batch.commit()
  }
}
