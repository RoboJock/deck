import { Link } from 'react-router-dom'

export function UnsavedNotice() {
  return (
    <aside className="unsaved">
      <strong>This deck will disappear.</strong>
      <p>
        It is stored only in this browser. Create an account to save it. Without
        an account, it is gone when this browser data is cleared or you switch
        devices.
      </p>
      <Link className="account-link" to="/account">
        Create an account to save it
      </Link>
    </aside>
  )
}
