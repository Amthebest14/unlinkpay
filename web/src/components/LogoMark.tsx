import { MARK_PATH } from './markPath'

// Takes its color from CSS (`color`), so light and dark themes need no separate files.
export function LogoMark({ height, title, className }: { height: number; title?: string; className?: string }) {
  return (
    <svg
      className={className ? `logo-mark ${className}` : 'logo-mark'}
      viewBox="0 0 916 512"
      height={height}
      width={Math.round((height * 916) / 512)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path fill="currentColor" d={MARK_PATH} />
    </svg>
  )
}
