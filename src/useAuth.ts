import { useContext } from 'react'
import { AuthContext } from './auth-context.ts'

export function useAuth() {
  return useContext(AuthContext)
}
