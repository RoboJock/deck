import { Link } from 'react-router-dom'

export function UnsavedNotice() {
  return (
    <aside className="unsaved">
      <p>
        <strong>This deck stays in this browser.</strong> Create an account to save it. Without an
        account, you cannot list a deck publicly.
      </p>
      <div className="pair">
        <Link className="account-link" to="/account">
          Create an account
        </Link>
        <Link className="account-link secondary" to="/account?mode=sign-in">
          Sign in
        </Link>
      </div>
    </aside>
  )
}
