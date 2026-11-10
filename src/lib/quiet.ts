let quiet = false
const listeners = new Set<() => void>()

export function isStudyQuiet() {
  return quiet
}

export function setStudyQuiet(next: boolean) {
  quiet = next
  listeners.forEach((listener) => listener())
}

export function subscribeStudyQuiet(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
