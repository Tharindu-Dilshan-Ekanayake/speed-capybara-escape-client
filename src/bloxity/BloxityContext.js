import { createContext, useContext } from 'react'

export const BloxityContext = createContext(null)

/**
 * Access the Bloxity session: `user`, `guest`, `isLoggedIn`, `avatar` (equipped IDs),
 * `proportions`, and the `game` loading helpers. There is deliberately no login/logout:
 * the game plays as the signed-in Bloxity account, or as a guest when there is none.
 *
 * Must be called inside a `<BloxityProvider>`.
 */
export function useBloxity() {
  const ctx = useContext(BloxityContext)
  if (!ctx) throw new Error('useBloxity() must be used inside <BloxityProvider>')
  return ctx
}
