import { LogoMark } from '../components/LogoMark'
import { SecretTicket } from '../components/SecretTicket'
import { USDC } from '../lib/money'
import { href } from '../router'

const EXAMPLE_SECRET = 'unlinkpay:7f3a9c52e8b14d06a2f97c3e5b18d4a0c6e29f71b3d58a4e0c9f26b7d13e21b0'

export function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <LogoMark height={40} title="UnlinkPay" className="hero-mark" />
          <h1>Fund a fresh wallet. Leave no link.</h1>
          <p className="lead">
            Deposit from the wallet people know. Claim later from a brand-new one. Nobody watching can match the two.
          </p>
          <div className="actions">
            <a className="btn btn-primary btn-lg" href={href('deposit')}>
              Start a deposit
            </a>
            <a className="btn btn-lg" href={href('claim')}>
              Claim with a secret
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <SecretTicket secret={EXAMPLE_SECRET} amount={100n * USDC} example />
        </div>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <ol className="timeline">
          <li>
            <h3>Deposit</h3>
            <p>Send exactly 100 or 1,000 USDC from your known wallet. Every deposit of a size looks the same.</p>
          </li>
          <li>
            <h3>Save your secret</h3>
            <p>Your browser makes a random secret. Only its fingerprint is sent. The secret stays with you.</p>
          </li>
          <li>
            <h3>Wait for the crowd</h3>
            <p>At least 10 more deposits of the same size and 24 hours must pass. Yours blends in.</p>
          </li>
          <li>
            <h3>Claim to a fresh wallet</h3>
            <p>Paste the secret and a new address. A relayer pays the gas, so the new wallet can start empty.</p>
          </li>
        </ol>
      </section>

      <section className="section">
        <h2>Costs and limits</h2>
        <dl className="figures">
          <div>
            <dt>Fee when you claim</dt>
            <dd>0.30%</dd>
          </div>
          <div>
            <dt>Fee when you refund</dt>
            <dd>None</dd>
          </div>
          <div>
            <dt>Note sizes</dt>
            <dd>100 or 1,000 USDC</dd>
          </div>
          <div>
            <dt>Per wallet, invite-only pilot</dt>
            <dd>1,000 USDC</dd>
          </div>
        </dl>
      </section>

      <section className="section band">
        <div className="band-col">
          <h2>How your privacy is protected</h2>
          <ul className="plain-list">
            <li>
              The rules run on Horizen Vela, inside a sealed computer that even its operators can't look into. Privacy
              comes from that sealed computer, not from cryptography alone.
            </li>
            <li>Your secret is made in your browser. Only its fingerprint is ever sent.</li>
            <li>Nothing on this site loads from other companies' servers, so they never see your visit.</li>
          </ul>
        </div>
        <div className="band-col">
          <h2>How misuse is stopped</h2>
          <ul className="plain-list">
            <li>Every deposit is checked against sanctions lists. A flagged wallet can only take its own money back.</li>
            <li>The 24-hour wait gives time for stolen funds to be flagged before anyone can claim.</li>
            <li>Approved auditors, listed publicly on-chain, can request a report. Nobody else can.</li>
          </ul>
        </div>
      </section>

      <section className="section honest">
        <h2>Before you deposit</h2>
        <div className="honest-grid">
          <p>
            <strong>Lose your secret and only your original wallet can get the money back.</strong> Save it the moment you
            see it.
          </p>
          <p>
            <strong>If Vela stops running, there is no way to withdraw on your own yet.</strong> Start with an amount
            you're comfortable leaving in a new system.
          </p>
        </div>
        <div className="actions">
          <a className="btn btn-primary btn-lg" href={href('deposit')}>
            Start a deposit
          </a>
          <a className="btn btn-lg" href={href('risks')}>
            Read the risk notice
          </a>
        </div>
      </section>
    </>
  )
}
