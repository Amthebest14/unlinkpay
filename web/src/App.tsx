import { DemoPanel } from './components/DemoPanel'
import { LogoMark } from './components/LogoMark'
import { WalletButton } from './components/WalletButton'
import { Claim } from './pages/Claim'
import { Deposit } from './pages/Deposit'
import { Home } from './pages/Home'
import { Refund } from './pages/Refund'
import { Stats } from './pages/Stats'
import { Status } from './pages/Status'
import { href, useRoute, type Route } from './router'
import { IS_DEMO } from './vela'

const NAV: [Route, string][] = [
  ['deposit', 'Deposit'],
  ['status', 'Status'],
  ['claim', 'Claim'],
  ['refund', 'Refund'],
  ['stats', 'Stats'],
]

const PAGES: Record<Route, () => React.JSX.Element> = {
  home: Home,
  deposit: Deposit,
  status: Status,
  claim: Claim,
  refund: Refund,
  stats: Stats,
}

export function App() {
  const route = useRoute()
  const Page = PAGES[route]

  return (
    <>
      {IS_DEMO && (
        <p className="demo-banner" role="note">
          Demo. No real money moves: Vela is simulated in your browser.
        </p>
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href={href('home')}>
            <LogoMark height={18} />
            UnlinkPay
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map(([r, label]) => (
              <a key={r} href={href(r)} aria-current={route === r ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <WalletButton />
        </div>
      </header>
      <main className="main">
        <Page key={route} />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <p>UnlinkPay runs on Horizen Vela. Privacy comes from a sealed computer, not from cryptography alone.</p>
          <p>Not financial advice. Check the rules where you live before you deposit.</p>
        </div>
      </footer>
      {IS_DEMO && <DemoPanel />}
    </>
  )
}
