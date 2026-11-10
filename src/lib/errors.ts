import { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/operation-not-allowed':
    'Email and password sign-in is off. In the Firebase console, open Authentication and enable the Email/Password provider.',
  'auth/email-already-in-use':
    'An account with that email already exists. Sign in instead.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/invalid-credential': 'Email or password does not match.',
  'auth/wrong-password': 'Email or password does not match.',
  'auth/user-not-found': 'Email or password does not match.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed':
    'Could not reach Firebase. Check your connection and try again.',
  'permission-denied':
    'Firestore blocked this request. Create the database in production mode, then deploy the rules file.',
  'failed-precondition':
    'Firestore is not ready. Create a database for this project, then try again.',
  unavailable: 'Could not reach Firebase. Check your connection and try again.',
  'not-found': 'That deck does not exist.',
}

export function explain(error: unknown): string {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
