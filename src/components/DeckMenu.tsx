import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { listGuestDecks, subscribeGuestDecks } from '../lib/guestDecks.ts'
import { useAuth } from '../useAuth.ts'

type MenuDeck = {
  id: string
  title: string
  ownerId: string
}

export function DeckMenu() {
  const { user } = useAuth()
  const location = useLocation()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(location.pathname)
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname)
    setOpen(false)
  }
  const [mine, setMine] = useState<MenuDeck[]>([])
  const [others, setOthers] = useState<MenuDeck[]>([])
  const [guestDecks, setGuestDecks] = useState(listGuestDecks())
  const [othersNote, setOthersNote] = useState<string | null>(null)

  useEffect(() => subscribeGuestDecks(() => setGuestDecks(listGuestDecks())), [])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

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

  const yourDecks: MenuDeck[] = user
    ? mine
    : guestDecks.map((deck) => ({ id: deck.id, title: deck.title, ownerId: '' }))
  const otherDecks = others.filter((deck) => deck.ownerId !== user?.uid)

  return (
    <div className="deck-menu" ref={root}>
      <button
        type="button"
        className="secondary deck-menu-button"
        aria-expanded={open}
        aria-controls="deck-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        Decks
      </button>
      {open ? (
        <div className="deck-panel" id="deck-menu-panel">
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
          <NavLink className="side-study" to="/#examples">
            Example decks
          </NavLink>
        </div>
      ) : null}
    </div>
  )
}
