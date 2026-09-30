import { useEffect, useState } from 'react'
import { vela } from '.'

// Vela's clock (the demo can skip ahead), refreshed every second.
export function useVelaNow(): number {
  const [now, setNow] = useState(() => vela.now())
  useEffect(() => {
    const id = setInterval(() => setNow(vela.now()), 1000)
    const unsubscribe = vela.subscribe(() => setNow(vela.now()))
    return () => {
      clearInterval(id)
      unsubscribe()
    }
  }, [])
  return now
}
