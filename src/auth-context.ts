import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthState = {
  user: User | null
  ready: boolean
}

export const AuthContext = createContext<AuthState>({ user: null, ready: false })
