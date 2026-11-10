import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.ts'
import { useAuth } from '../useAuth.ts'

export function Header({ showAccount = true }: { showAccount?: boolean }) {
  const { user, ready } = useAuth()

  return (
    <header className="top">
      <Link to="/" className="brand">
        Deck
      </Link>
      {ready && user ? (
        <div className="row tight">
          <span className="status">{user.email}</span>
          <button type="button" className="secondary" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      ) : showAccount ? (
        <Link className="account-link" to="/account">
          Create an account
        </Link>
      ) : null}
    </header>
  )
}
