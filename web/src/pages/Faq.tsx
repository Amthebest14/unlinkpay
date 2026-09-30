import type { ReactNode } from 'react'
import { href } from '../router'

const GROUPS: { title: string; items: [string, ReactNode][] }[] = [
  {
    title: 'The basics',
    items: [
      [
        'What is UnlinkPay?',
        'A way to fund a brand-new wallet from a wallet people know is yours, without anyone watching being able to tell the two are connected.',
      ],
      [
        'How does it break the link?',
        'Everyone deposits the same fixed amounts, so deposits look alike. You keep a secret, and only its fingerprint is sent. After at least 10 more deposits of the same size and 24 hours, anyone with the secret can claim to a fresh wallet through a relayer. People watching see deposits and claims, but not which one belongs to which.',
      ],
      [
        'What does it cost?',
        '0.30% of each claim, so a 100 USDC note pays out 99.70 USDC. Refunds are free. The relayer pays the gas for claims, so the fresh wallet can start empty.',
      ],
      ['Which money can I use?', 'USDC only, in notes of exactly 100 or 1,000. It starts on Base Sepolia (test money) and moves to Base later.'],
      [
        'Is it live?',
        'Not yet. This site is a demo: Horizen Vela is simulated in your browser and no real money moves. Real test deposits come once UnlinkPay runs on Vela.',
      ],
    ],
  },
  {
    title: 'Privacy',
    items: [
      [
        'Who can see what?',
        <>
          Anyone can see that your known wallet deposited, and that some fresh wallet claimed. The relayer sees the internet
          address a claim comes from, but only an encrypted request. Horizen Vela's operators can't see inside the sealed
          computer. Approved auditors, listed publicly on-chain, can request a report on a specific withdrawal. Nobody else
          can.
        </>,
      ],
      [
        'Where does the privacy come from?',
        'From a sealed computer (a trusted execution environment) that runs the rules and keeps the list of which deposit belongs to which secret. UnlinkPay does not use zero-knowledge cryptography, so privacy depends on that sealed computer staying sealed.',
      ],
      [
        'Why wait for 10 deposits and 24 hours?',
        'The 10 later deposits are the crowd your deposit hides in. The 24 hours stop anyone matching a deposit and a claim by timing, and give sanctions lists time to flag stolen funds before they can be claimed.',
      ],
      [
        'How do I keep my claim private?',
        'Claim from a different browser or a private window, use a VPN or Tor or at least a different network, and pick a random time rather than the moment your note unlocks. Never connect the wallet you deposited from on the Claim page.',
      ],
    ],
  },
  {
    title: 'Your money',
    items: [
      [
        'What if I lose my secret?',
        'The wallet you deposited from can take the money back on the Refund page, with no fee and no secret needed. If you lose both the secret and that wallet, nobody can recover the money.',
      ],
      [
        'Can I change my mind?',
        'Yes. Until a note is claimed, the wallet that deposited can refund it. Refunds are public, so a refunded note stops hiding anyone.',
      ],
      [
        'Will UnlinkPay ever ask for my secret?',
        'Never. UnlinkPay will not message you, and nobody from UnlinkPay will ever ask for your secret. Anyone who does is trying to take your money. Only paste it into the Status or Claim page on unlinkpay.xyz.',
      ],
      [
        'What if Horizen Vela stops running?',
        "There's no way to withdraw on your own yet. That's why deposits are capped during the pilot. Only deposit an amount you're comfortable leaving in a new system.",
      ],
    ],
  },
  {
    title: 'Rules and compliance',
    items: [
      [
        'Is this a mixer like Tornado Cash?',
        'It breaks the link the same way, but with checks built in. Every deposit is screened against sanctions lists, a flagged wallet can only take its own money back, approved auditors can request reports, and the pilot is invite-only with limits.',
      ],
      [
        'Why is there a limit?',
        'During the invite-only pilot, each wallet can lock up to 1,000 USDC in total. It keeps the risk small while the system is new, and goes up after an external audit.',
      ],
    ],
  },
]

export function Faq() {
  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>Questions</h1>
        <p className="lead">
          Plain answers about how UnlinkPay works and what it can and can't protect. For the risks in full, read the{' '}
          <a href={href('risks')}>risk notice</a>.
        </p>
      </header>
      {GROUPS.map((group) => (
        <section key={group.title} className="faq-group">
          <h2>{group.title}</h2>
          {group.items.map(([question, answer]) => (
            <details key={question} className="faq-item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>
      ))}
    </div>
  )
}
