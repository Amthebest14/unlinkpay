package core

import (
	"errors"
	"fmt"
	"testing"
)

func newApp(t *testing.T) *State {
	t.Helper()
	s, err := New(Config{Denominations: []Money{100 * USDC, 1000 * USDC}, MinCrowd: 3, FeeBps: 30})
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// lockFor deposits and locks one 100 USDC note for a wallet.
func lockFor(t *testing.T, s *State, wallet, secret string) {
	t.Helper()
	s.Deposit(wallet, 100*USDC)
	if err := s.Lock(wallet, 100*USDC, Fingerprint(secret)); err != nil {
		t.Fatal(err)
	}
}

func TestClaimBlockedUntilCrowdIsBigEnough(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "alice-secret")
	// Only 2 later notes: not enough (K=3).
	lockFor(t, s, "bob", "bob-secret")
	lockFor(t, s, "carol", "carol-secret")
	_, err := s.Claim("alice-secret", "fresh-wallet")
	if !errors.Is(err, ErrCrowdSmall) {
		t.Fatalf("want ErrCrowdSmall, got %v", err)
	}
	// A third later note unlocks it.
	lockFor(t, s, "dave", "dave-secret")
	p, err := s.Claim("alice-secret", "fresh-wallet")
	if err != nil {
		t.Fatal(err)
	}
	// 100 USDC minus 0.30% = 99.70 USDC
	if p.To != "fresh-wallet" || p.Amount != 99_700_000 {
		t.Fatalf("bad payout %+v", p)
	}
	if s.Fees != 300_000 {
		t.Fatalf("fees = %d", s.Fees)
	}
}

func TestCannotClaimTwice(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	for i := 0; i < 3; i++ {
		lockFor(t, s, fmt.Sprintf("w%d", i), fmt.Sprintf("s%d", i))
	}
	if _, err := s.Claim("a", "x"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Claim("a", "x"); !errors.Is(err, ErrSpent) {
		t.Fatalf("want ErrSpent, got %v", err)
	}
}

func TestWrongSecretFails(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "right")
	if _, err := s.Claim("wrong", "x"); !errors.Is(err, ErrUnknownNote) {
		t.Fatalf("want ErrUnknownNote, got %v", err)
	}
}

func TestOnlyFixedSizes(t *testing.T) {
	s := newApp(t)
	s.Deposit("alice", 50*USDC)
	if err := s.Lock("alice", 50*USDC, Fingerprint("s")); !errors.Is(err, ErrBadDenom) {
		t.Fatalf("want ErrBadDenom, got %v", err)
	}
}

func TestCannotLockMoreThanCredited(t *testing.T) {
	s := newApp(t)
	s.Deposit("alice", 99*USDC)
	if err := s.Lock("alice", 100*USDC, Fingerprint("s")); !errors.Is(err, ErrNoBalance) {
		t.Fatalf("want ErrNoBalance, got %v", err)
	}
}

func TestDifferentSizesDoNotMixCrowds(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	// Three 1000 USDC notes must NOT count as crowd for a 100 USDC note.
	for i := 0; i < 3; i++ {
		w := fmt.Sprintf("w%d", i)
		s.Deposit(w, 1000*USDC)
		if err := s.Lock(w, 1000*USDC, Fingerprint(w)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Claim("a", "x"); !errors.Is(err, ErrCrowdSmall) {
		t.Fatalf("want ErrCrowdSmall, got %v", err)
	}
}

func TestRefundOnlyByDepositorAndNotAfterClaim(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	fp := Fingerprint("a")
	if _, err := s.Refund("mallory", fp); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("want ErrNotOwner, got %v", err)
	}
	p, err := s.Refund("alice", fp)
	if err != nil || p.Amount != 100*USDC {
		t.Fatalf("refund failed: %+v %v", p, err)
	}
	if _, err := s.Claim("a", "x"); !errors.Is(err, ErrSpent) {
		t.Fatalf("want ErrSpent after refund, got %v", err)
	}
}

func TestRefundedNotesDoNotCountAsCrowd(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	for i := 0; i < 3; i++ {
		lockFor(t, s, fmt.Sprintf("w%d", i), fmt.Sprintf("s%d", i))
	}
	// One of the three walks away; the crowd shrinks to 2.
	if _, err := s.Refund("w0", Fingerprint("s0")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Claim("a", "x"); !errors.Is(err, ErrCrowdSmall) {
		t.Fatalf("want ErrCrowdSmall, got %v", err)
	}
}
