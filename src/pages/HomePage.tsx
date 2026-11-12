import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { explain } from '../lib/errors.ts'
import { loadDailyPile } from '../lib/daily.ts'
import { migrateGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'

const uses = [
  {
    title: 'A language',
    detail: 'Practice the words and phrases you want to say without looking them up.',
  },
  {
    title: 'A class or a test',
    detail: 'Turn notes into cards and come back to the ones that have not stuck yet.',
  },
  {
    title: 'Facts you keep forgetting',
    detail: 'Commands, recipes, names, dates, or anything else worth keeping close.',
  },
  {
    title: 'A group of people',
    detail: 'Share a deck, or copy someone else’s and change it until it fits you.',
  },
]

const features = [
  {
    title: 'Cards you write yourself',
    detail: 'Put words or a picture on either side. Reorder the cards, or bring them in from a spreadsheet.',
  },
  {
    title: 'A simple way to study',
    detail: 'Click the card or press space to flip it. Then mark Got it, Skip, or Don’t know.',
  },
  {
    title: 'Progress that stays',
    detail: 'Missed cards come back next time, and a daily pile gathers what is waiting.',
  },
  {
    title: 'A quieter way to practice',
    detail: 'Type the answer before you flip, hide the rest of the page, or fill the screen.',
  },
  {
    title: 'Decks you can pass on',
    detail: 'With an account, list a deck for anyone with the link. They can study it or copy it.',
  },
  {
    title: 'Something to try first',
    detail: 'Open an example deck before you make your own. You can start without an account.',
  },
]

export function HomePage() {
  const { user } = useAuth()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDailyPile(user?.uid ?? null)
      .then((pile) => {
        if (!cancelled) setWaiting(pile.length)
      })
      .catch(() => {
        if (!cancelled) setWaiting(0)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    migrateGuestDecks(user.uid)
      .then((count) => {
        if (!cancelled && count > 0) {
          setNotice(
            count === 1
              ? 'Saved 1 deck from this browser to your account.'
              : `Saved ${count} decks from this browser to your account.`,
          )
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(explain(caught))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="frame">
      <main className="wrap">
        <div className="home-stage">
          <div className="home-intro">
            <p className="eyebrow">Study Deck</p>
            <h1>Flip through what you want to remember.</h1>
            <p className="lede">
              Study Deck is a flashcard app in the browser. Make a deck, practice the cards until they stick, and share it when someone else should study it too.
            </p>
            <div className="pair">
              <Link className="account-link" to="/create">
                Create a deck
              </Link>
              <Link className="account-link secondary" to="/examples">
                Try an example
              </Link>
            </div>
            {waiting !== null && waiting > 0 ? (
              <p className="lede">
                <Link to="/daily">
                  {waiting === 1 ? '1 card is waiting today.' : `${waiting} cards are waiting today.`}
                </Link>
              </p>
            ) : null}
            {notice ? <p className="saved">{notice}</p> : null}
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <article className="index-card home-sample" aria-hidden="true">
            <p className="card-kicker">Front</p>
            <p className="card-face">What is a deck?</p>
            <p className="card-kicker back-kicker">Back</p>
            <p className="card-face">A stack of cards you can flip.</p>
          </article>
        </div>
        <section className="home-examples">
          <h2>What you can use it for</h2>
          <p className="lede">A deck can be as small as a few words, or a whole set you come back to.</p>
          <ul className="home-picks">
            {uses.map((item) => (
              <li key={item.title} className="home-pick">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="home-examples">
          <h2>What you can do today</h2>
          <p className="lede">These are the pieces already in the app.</p>
          <ul className="home-picks welcome-features">
            {features.map((item) => (
              <li key={item.title} className="home-pick">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
