// Package core is the "brain" of UnlinkPay.
//
// It contains ONLY the rules: who can put money in, when money can come out,
// and how much the fee is. It knows nothing about Vela, blockchains or WASM.
// That is on purpose: we can test the rules quickly on a laptop, and later a
// thin "bridge" file will plug this brain into the Vela enclave.
//
// The story in four steps:
//
//  1. DEPOSIT   Alice sends 100 USDC from her known wallet. The app credits her.
//  2. LOCK      Alice picks a secret, and gives the app only its fingerprint
//     (a hash). The app moves her 100 USDC into a sealed "note"
//     labelled with that fingerprint.
//  3. WAIT      More people lock notes of the same size. Each later note is a
//     member of the crowd Alice hides in.
//  4. CLAIM     Once at least K later notes exist and the minimum wait has
//     passed, whoever holds the SECRET can ask for the money to go to
//     any fresh wallet.
//
// One principle runs through every rule: money can always go back to the
// wallet it came from. The rules only limit locking and claiming.
package core

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
)

// Money is counted in the token's smallest unit. USDC has 6 decimals, so
// 100 USDC = 100_000_000. (Vela's own 256-bit number type is used at the
// bridge; uint64 is plenty for these sizes and keeps the rules easy to read.)
type Money uint64

const USDC Money = 1_000_000

// Config holds the fixed settings chosen when the app is deployed.
type Config struct {
	// Denominations are the only allowed note sizes, e.g. 100 and 1000 USDC.
	// Fixed sizes are what make the crowd work: all notes look identical.
	Denominations []Money
	// MinCrowd (K) is how many LATER notes of the same size must exist
	// before a note can be claimed.
	MinCrowd int
	// FeeBps is the withdrawal fee in basis points (30 = 0.30%).
	FeeBps uint64
	// MinWaitSecs is how long a note must sit before it can be claimed, so
	// "lock and withdraw straight away" is impossible. 0 = no wait.
	MinWaitSecs uint64
	// InviteOnly means only wallets added with Invite can lock notes.
	InviteOnly bool
	// MaxLockPerWallet caps the total one wallet can ever lock. 0 = no cap.
	MaxLockPerWallet Money
}

// Note is one sealed deposit waiting to be claimed.
type Note struct {
	Denom     Money  `json:"denom"`
	Seq       uint64 `json:"seq"`       // order within its denomination: 1st, 2nd, 3rd...
	Depositor string `json:"depositor"` // known wallet; used ONLY for refunds, never shown
	LockedAt  uint64 `json:"lockedAt"`  // time of locking, in seconds
	Claimed   bool   `json:"claimed"`
	Refunded  bool   `json:"refunded"`
}

// State is everything the app remembers. In Vela it is stored encrypted, so
// only the enclave can read it.
type State struct {
	Config   Config           `json:"config"`
	Balances map[string]Money `json:"balances"` // credited but not yet locked, per wallet
	Notes    map[string]*Note `json:"notes"`    // keyed by fingerprint (hash of the secret)
	NextSeq  map[Money]uint64 `json:"nextSeq"`  // per denomination counter
	Fees     Money            `json:"fees"`     // fees collected so far
	Locked   map[string]Money `json:"locked"`   // total ever locked, per wallet (for the cap)
	Invited  map[string]bool  `json:"invited"`  // wallets allowed to lock when InviteOnly
	Flagged  map[string]bool  `json:"flagged"`  // wallets the sanctions check flagged: refund only
}

// Payout is an instruction to send money out to a wallet on-chain.
type Payout struct {
	To     string
	Amount Money
}

// NoteInfo is what a depositor sees about one of their own waiting notes.
type NoteInfo struct {
	Fingerprint string `json:"fingerprint"`
	Denom       Money  `json:"denom"`
	Seq         uint64 `json:"seq"`
}

var (
	ErrBadDenom    = errors.New("amount is not an allowed note size")
	ErrNoBalance   = errors.New("not enough credited balance")
	ErrDuplicate   = errors.New("that fingerprint is already used")
	ErrUnknownNote = errors.New("no note matches that secret")
	ErrSpent       = errors.New("note already claimed or refunded")
	ErrCrowdSmall  = errors.New("crowd is not big enough yet")
	ErrNotOwner    = errors.New("only the original depositor can refund")
	ErrBadConfig   = errors.New("bad config")
	ErrTooSoon     = errors.New("note is too new to claim yet")
	ErrFlagged     = errors.New("wallet is flagged: refund only")
	ErrNotInvited  = errors.New("wallet is not on the invite list")
	ErrOverCap     = errors.New("wallet has reached its lock limit")
)

// New creates an empty app with the given settings.
func New(cfg Config) (*State, error) {
	if len(cfg.Denominations) == 0 || cfg.MinCrowd < 1 || cfg.FeeBps > 1000 {
		return nil, ErrBadConfig
	}
	return &State{
		Config:   cfg,
		Balances: map[string]Money{},
		Notes:    map[string]*Note{},
		NextSeq:  map[Money]uint64{},
		Locked:   map[string]Money{},
		Invited:  map[string]bool{},
		Flagged:  map[string]bool{},
	}, nil
}

// Fingerprint turns a secret into its public fingerprint (SHA-256, hex).
// Anyone can compute a fingerprint from a secret, but nobody can go backwards.
func Fingerprint(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func (s *State) allowed(d Money) bool {
	for _, x := range s.Config.Denominations {
		if x == d {
			return true
		}
	}
	return false
}

// Invite adds a wallet to the invite list (used when InviteOnly is on).
func (s *State) Invite(wallet string) {
	s.Invited[wallet] = true
}

// Flag marks a wallet the sanctions check rejected. It can still get its own
// money back, but cannot lock new notes, and its notes cannot be claimed.
func (s *State) Flag(wallet string) {
	s.Flagged[wallet] = true
}

// Deposit credits a wallet with money that arrived on-chain.
func (s *State) Deposit(wallet string, amount Money) {
	s.Balances[wallet] += amount
}

// WithdrawCredit sends back credit that was never locked, e.g. the extra 50
// from a 150 deposit. It only ever goes to the wallet it came from.
func (s *State) WithdrawCredit(wallet string) (Payout, error) {
	amount := s.Balances[wallet]
	if amount == 0 {
		return Payout{}, ErrNoBalance
	}
	delete(s.Balances, wallet)
	return Payout{To: wallet, Amount: amount}, nil
}

// Lock seals `denom` of the wallet's credit into a note labelled `fingerprint`.
// `now` is the current time in seconds.
func (s *State) Lock(wallet string, denom Money, fingerprint string, now uint64) error {
	if !s.allowed(denom) {
		return ErrBadDenom
	}
	if s.Flagged[wallet] {
		return ErrFlagged
	}
	if s.Config.InviteOnly && !s.Invited[wallet] {
		return ErrNotInvited
	}
	if s.Config.MaxLockPerWallet > 0 && s.Locked[wallet]+denom > s.Config.MaxLockPerWallet {
		return ErrOverCap
	}
	if s.Balances[wallet] < denom {
		return ErrNoBalance
	}
	if _, exists := s.Notes[fingerprint]; exists {
		return ErrDuplicate
	}
	s.Balances[wallet] -= denom
	s.Locked[wallet] += denom
	s.NextSeq[denom]++
	s.Notes[fingerprint] = &Note{Denom: denom, Seq: s.NextSeq[denom], Depositor: wallet, LockedAt: now}
	return nil
}

// crowdAfter counts notes of the same size locked AFTER this one and still
// in the pool (not refunded). These are the "other people" hiding alongside.
func (s *State) crowdAfter(n *Note) int {
	count := 0
	for _, o := range s.Notes {
		if o.Denom == n.Denom && o.Seq > n.Seq && !o.Refunded {
			count++
		}
	}
	return count
}

// Fee returns the withdrawal fee for a note size.
func (s *State) Fee(denom Money) Money {
	return Money(uint64(denom) * s.Config.FeeBps / 10_000)
}

// Claim pays out a note to `to` if the secret is right, the note has waited
// long enough, and the crowd is big enough. `now` is the current time in seconds.
func (s *State) Claim(secret, to string, now uint64) (Payout, error) {
	n, ok := s.Notes[Fingerprint(secret)]
	if !ok {
		return Payout{}, ErrUnknownNote
	}
	if n.Claimed || n.Refunded {
		return Payout{}, ErrSpent
	}
	if s.Flagged[n.Depositor] {
		return Payout{}, ErrFlagged
	}
	if now < n.LockedAt+s.Config.MinWaitSecs {
		return Payout{}, ErrTooSoon
	}
	if have := s.crowdAfter(n); have < s.Config.MinCrowd {
		return Payout{}, fmt.Errorf("%w: have %d of %d", ErrCrowdSmall, have, s.Config.MinCrowd)
	}
	fee := s.Fee(n.Denom)
	n.Claimed = true
	s.Fees += fee
	return Payout{To: to, Amount: n.Denom - fee}, nil
}

// NotesOf lists a wallet's notes that are still waiting, so the depositor can
// find the fingerprint and refund even after losing the secret.
// The bridge must only answer this for the wallet itself.
func (s *State) NotesOf(wallet string) []NoteInfo {
	var out []NoteInfo
	for fp, n := range s.Notes {
		if n.Depositor == wallet && !n.Claimed && !n.Refunded {
			out = append(out, NoteInfo{Fingerprint: fp, Denom: n.Denom, Seq: n.Seq})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Denom != out[j].Denom {
			return out[i].Denom < out[j].Denom
		}
		return out[i].Seq < out[j].Seq
	})
	return out
}

// Refund is the safety exit: the original depositor can take back an
// unclaimed note, no fee charged. Flagged wallets can refund too.
func (s *State) Refund(wallet, fingerprint string) (Payout, error) {
	n, ok := s.Notes[fingerprint]
	if !ok {
		return Payout{}, ErrUnknownNote
	}
	if n.Claimed || n.Refunded {
		return Payout{}, ErrSpent
	}
	if n.Depositor != wallet {
		return Payout{}, ErrNotOwner
	}
	n.Refunded = true
	return Payout{To: wallet, Amount: n.Denom}, nil
}
