import { Link } from 'react-router-dom'

export function UnsavedNotice() {
  return (
    <aside className="unsaved">
      <p>
        <strong>This deck will disappear</strong> unless you create an account.
      </p>
      <Link className="account-link" to="/account">
        Create an account
      </Link>
    </aside>
  )
}
