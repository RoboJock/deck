import { useState } from 'react'
import type { CardRecord } from '../types.ts'

export function StudyCards({ cards }: { cards: CardRecord[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (cards.length === 0) {
    return <p className="status">This deck has no cards yet.</p>
  }

  const safeIndex = Math.min(index, cards.length - 1)
  const card = cards[safeIndex]

  function show(nextIndex: number) {
    setIndex(nextIndex)
    setFlipped(false)
  }

  return (
    <div className="study">
      <button
        type="button"
        className="study-card"
        onClick={() => setFlipped((current) => !current)}
      >
        <span className="eyebrow">{flipped ? 'Back' : 'Front'}</span>
        <span className="study-text">{flipped ? card.back : card.front}</span>
        <span className="hint">Click the card to flip it</span>
      </button>
      <div className="row">
        <button
          type="button"
          className="secondary"
          disabled={safeIndex === 0}
          onClick={() => show(safeIndex - 1)}
        >
          Previous
        </button>
        <span className="status">
          {safeIndex + 1} of {cards.length}
        </span>
        <button
          type="button"
          className="secondary"
          disabled={safeIndex === cards.length - 1}
          onClick={() => show(safeIndex + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
