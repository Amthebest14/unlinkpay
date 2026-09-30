import { useEffect, useState } from 'react'

export type Route = 'home' | 'deposit' | 'status' | 'claim' | 'refund' | 'stats'

const PAGES: Route[] = ['deposit', 'status', 'claim', 'refund', 'stats']

function readRoute(): Route {
  const name = window.location.hash.replace(/^#\/?/, '')
  return (PAGES as string[]).includes(name) ? (name as Route) : 'home'
}

export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const href = (route: Route) => (route === 'home' ? '#/' : `#/${route}`)
