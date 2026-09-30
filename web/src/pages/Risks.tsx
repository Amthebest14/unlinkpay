import { href } from '../router'

const RISKS: [string, string][] = [
  ['It is a demo today.', 'No real money moves on this site. Horizen Vela is simulated in your browser until UnlinkPay runs on its testnet, and later on mainnet.'],
  [
    'Privacy depends on a sealed computer.',
    'The rules and the list linking deposits to secrets live inside a sealed computer run through Horizen Vela. If that sealed computer were broken into, links could be exposed. UnlinkPay does not use zero-knowledge cryptography.',
  ],
  [
    'Approved auditors can see links.',
    'Addresses listed in an on-chain registry of approved auditors can request a report on a specific withdrawal. This is by design, for compliance.',
  ],
  [
    'Your own habits can link you.',
    'Claiming the moment the wait ends, from the same browser or internet connection you deposited from, or to a wallet that later deals with your main one, can reveal the link. The crowd only helps if you blend in.',
  ],
  [
    'A lost secret can mean lost money.',
    'Anyone holding the secret can claim. If you lose it, only the wallet you deposited from can refund. If you lose that wallet too, nobody can recover the money.',
  ],
  ['There is no self-serve exit yet.', "If Horizen Vela stops running, you can't withdraw on your own until it runs again."],
  [
    'The software is new and unaudited.',
    'UnlinkPay has not had an external security audit yet; one is planned before mainnet. Horizen Vela itself is at an early version and may change or break.',
  ],
  [
    'Rules differ by country.',
    "Privacy tools are restricted in some places, and people who built them have faced legal action. You're responsible for following the law where you live. UnlinkPay blocks sanctioned wallets and plans to block restricted regions.",
  ],
  ['Fees are charged on claims.', 'Each claim pays a 0.30% fee. Refunds are free.'],
  ['There are no guarantees.', 'UnlinkPay is provided as is. Nothing here is financial or legal advice.'],
]

export function Risks() {
  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Risk notice</h1>
        <p className="lead">
          UnlinkPay is new software on a new platform. Read this before you deposit. It's written in plain words, not legal
          language.
        </p>
      </header>
      <ol className="risk-list">
        {RISKS.map(([title, body]) => (
          <li key={title}>
            <strong>{title}</strong> {body}
          </li>
        ))}
      </ol>
      <p className="next-link">
        More answers in the <a href={href('faq')}>questions</a>.
      </p>
    </div>
  )
}
