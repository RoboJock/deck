import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.ts'
import { useAuth } from '../useAuth.ts'

export function Header({
  menuOpen,
  onMenu,
}: {
  menuOpen: boolean
  onMenu: () => void
}) {
  const { user, ready } = useAuth()
  const location = useLocation()
  const onAccount = location.pathname === '/account'
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('deck-theme', next)
    setTheme(next)
  }

  return (
    <header className="top">
      <div className="top-start">
        <button
          type="button"
          className="secondary nav-toggle"
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          Menu
        </button>
        <NavLink to="/" className="brand">
          Deck
        </NavLink>
        <nav className="top-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Home
          </NavLink>
          <NavLink
            to="/decks"
            className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}
          >
            Decks
          </NavLink>
        </nav>
      </div>
      <div className="row">
        <button type="button" className="secondary" id="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {ready && user ? (
          <>
            <span className="status">{user.email}</span>
            <button type="button" className="secondary" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </>
        ) : onAccount ? null : (
          <span className="pair">
            <NavLink className="account-link" to="/account">
              Create an account
            </NavLink>
            <NavLink className="account-link secondary" to="/account?mode=sign-in">
              Sign in
            </NavLink>
          </span>
        )}
      </div>
    </header>
  )
}
