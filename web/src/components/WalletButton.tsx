import { useEffect, useRef, useState } from 'react'
import { useConnect, useConnection, useConnectors, useDisconnect, type Connector } from 'wagmi'
import { WalletIcon } from '@phosphor-icons/react'
import { shortAddress } from '../lib/format'

function connectorLabel(c: Connector): string {
  if (c.id === 'mock') return 'Demo wallet (no extension needed)'
  if (c.id === 'injected') return 'Browser wallet'
  return c.name
}

function connectErrorText(error: Error): string {
  if (error.name === 'ProviderNotFoundError') return 'No browser wallet found. Install one, or use the demo wallet.'
  if (error.name === 'UserRejectedRequestError') return 'The wallet request was cancelled.'
  return 'Could not connect. Try again.'
}

export function WalletButton() {
  const { address, isConnected } = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const disconnect = useDisconnect()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (isConnected && address) {
    return (
      <div className="wallet">
        <span className="wallet-address mono" title={address}>
          {shortAddress(address)}
        </span>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => disconnect.mutate()}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="wallet" ref={box}>
      <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <WalletIcon size={16} aria-hidden="true" />
        Connect wallet
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              role="menuitem"
              className="wallet-option"
              disabled={connect.isPending}
              onClick={() => connect.mutate({ connector: c }, { onSuccess: () => setOpen(false) })}
            >
              {connectorLabel(c)}
            </button>
          ))}
          {connect.error && <p className="field-error">{connectErrorText(connect.error)}</p>}
        </div>
      )}
    </div>
  )
}
