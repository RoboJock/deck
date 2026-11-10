import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { listGuestDecks, subscribeGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'

type SideDeck = {
  id: string
  title: string
  ownerId: string
}

export function Sidebar({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const { user } = useAuth()
  const [mine, setMine] = useState<SideDeck[]>([])
  const [others, setOthers] = useState<SideDeck[]>([])
  const [guestDecks, setGuestDecks] = useState(listGuestDecks())
  const [othersNote, setOthersNote] = useState<string | null>(null)

  useEffect(() => subscribeGuestDecks(() => setGuestDecks(listGuestDecks())), [])

  useEffect(() => {
    if (!user) return
    const decksQuery = query(collection(db, 'decks'), where('ownerId', '==', user.uid))
    return onSnapshot(decksQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          title: String(data.title ?? 'Untitled'),
          ownerId: String(data.ownerId ?? ''),
        }
      })
      next.sort((a, b) => a.title.localeCompare(b.title))
      setMine(next)
    })
  }, [user])

  useEffect(() => {
    const decksQuery = query(
      collection(db, 'decks'),
      where('visibility', '==', 'public'),
      limit(40),
    )
    return onSnapshot(
      decksQuery,
      (snapshot) => {
        const next = snapshot.docs.map((item) => {
          const data = item.data()
return {
          id: item.id,
          title: String(data.title ?? 'Untitled'),
          ownerId: String(data.ownerId ?? ''),
        }
        })
        next.sort((a, b) => a.title.localeCompare(b.title))
        setOthers(next)
        setOthersNote(null)
      },
      () => setOthersNote('Public decks could not be loaded.'),
    )
  }, [])

  const yourDecks: SideDeck[] = user
    ? mine
    : guestDecks.map((deck) => ({ id: deck.id, title: deck.title, ownerId: '' }))
  const otherDecks = others.filter((deck) => deck.ownerId !== user?.uid)

  return (
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <button type="button" className="secondary sidebar-toggle" onClick={onToggle}>
        {open ? 'Hide decks' : 'Decks'}
      </button>
      {open ? (
        <div className="sidebar-body">
          <section>
            <h2>Your decks</h2>
            {yourDecks.length === 0 ? (
              <p className="status">No decks yet.</p>
            ) : (
              <ul>
                {yourDecks.map((deck) => (
                  <li key={deck.id} className="side-row">
                    <NavLink
                      to={`/decks/${deck.id}`}
                      className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
                    >
                      {deck.title}
                    </NavLink>
                    <NavLink className="side-study" to={`/study/${deck.id}`}>
                      Study
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2>From others</h2>
            {othersNote ? <p className="status">{othersNote}</p> : null}
            {otherDecks.length === 0 ? (
              <p className="status">No public decks yet.</p>
            ) : (
              <ul>
                {otherDecks.map((deck) => (
                  <li key={deck.id}>
                    <NavLink
                      to={`/study/${deck.id}`}
                      className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
                    >
                      {deck.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  )
}
