export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function formatDuration(secs: number): string {
  if (secs <= 0) return 'now'
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${Math.max(minutes, 1)}m`
}

export function formatWhen(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// "Sep 27"
export function formatDay(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "today at 14:20", "tomorrow at 09:15", "Friday at 18:40", relative to `nowSecs`.
export function dayWord(unixSecs: number, nowSecs: number): string {
  const when = new Date(unixSecs * 1000)
  const now = new Date(nowSecs * 1000)
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((midnight(when) - midnight(now)) / 86_400_000)
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const day = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : when.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day} at ${time}`
}
