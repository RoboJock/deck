import { Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.ts'
import { useAuth } from '../useAuth.ts'
import { DeckMenu } from './DeckMenu.tsx'

export function Header() {
  const { user, ready } = useAuth()
  const location = useLocation()
  const onAccount = location.pathname === '/account'

  return (
    <header className="top">
      <div className="top-start">
        <Link to="/" className="brand">
          Deck
        </Link>
        <DeckMenu />
      </div>
      {ready && user ? (
        <div className="row tight">
          <span className="status">{user.email}</span>
          <button type="button" className="secondary" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      ) : onAccount ? null : (
        <div className="row">
          <Link className="account-link" to="/account">
            Create an account
          </Link>
          <Link className="account-link secondary" to="/account?mode=sign-in">
            Sign in
          </Link>
        </div>
      )}
    </header>
  )
}
