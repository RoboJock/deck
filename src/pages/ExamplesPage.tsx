import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { explain } from '../lib/errors.ts'
import { copyExampleDeck, examples } from '../lib/examples.ts'
import { useAuth } from '../useAuth.ts'

export function ExamplesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)

  async function onCopy(exampleId: string) {
    const example = examples.find((item) => item.id === exampleId)
    if (!example) return
    setCopyingId(exampleId)
    setError(null)
    try {
      const id = await copyExampleDeck(example, user?.uid ?? null)
      navigate(`/decks/${id}`)
    } catch (caught) {
      setError(explain(caught))
    } finally {
      setCopyingId(null)
    }
  }

  return (
    <div className="frame">
      <main className="wrap">
        <h1>Example decks</h1>
        <p className="lede">Study one to see how a deck feels, then copy it and change the cards.</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="deck-list">
          {examples.map((deck) => (
            <li key={deck.id} className="deck-tile">
              <strong>{deck.title}</strong>
              <span className="status">{deck.blurb}</span>
              <span className="status">{deck.cards.length} cards</span>
              <div className="row">
                <Link className="account-link" to={`/study/${deck.id}`}>
                  Study
                </Link>
                <button
                  type="button"
                  className="secondary"
                  disabled={copyingId === deck.id}
                  onClick={() => onCopy(deck.id)}
                >
                  {copyingId === deck.id ? 'Copying…' : 'Copy'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
