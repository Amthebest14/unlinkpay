package core

import (
	"errors"
	"fmt"
	"strings"
	"testing"
)

func baseConfig() Config {
	return Config{Denominations: []Money{100 * USDC, 1000 * USDC}, MinCrowd: 3, FeeBps: 30}
}

func newAppWith(t *testing.T, cfg Config) *State {
	t.Helper()
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func newApp(t *testing.T) *State {
	t.Helper()
	return newAppWith(t, baseConfig())
}

// lockFor deposits and locks one 100 USDC note for a wallet at time 0.
func lockFor(t *testing.T, s *State, wallet, secret string) {
	t.Helper()
	s.Deposit(wallet, 100*USDC)
	if err := s.Lock(wallet, 100*USDC, Fingerprint(secret), 0); err != nil {
		t.Fatal(err)
	}
}

// addCrowd locks n more 100 USDC notes from different wallets.
func addCrowd(t *testing.T, s *State, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		lockFor(t, s, fmt.Sprintf("crowd%d", i), fmt.Sprintf("crowd-secret%d", i))
	}
}

func TestClaimBlockedUntilCrowdIsBigEnough(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "alice-secret")
	// Only 2 later notes: not enough (K=3).
	lockFor(t, s, "bob", "bob-secret")
	lockFor(t, s, "carol", "carol-secret")
	_, err := s.Claim("alice-secret", "fresh-wallet", 0)
	if !errors.Is(err, ErrCrowdSmall) {
		t.Fatalf("want ErrCrowdSmall, got %v", err)
	}
	// A third later note unlocks it.
	lockFor(t, s, "dave", "dave-secret")
	p, err := s.Claim("alice-secret", "fresh-wallet", 0)
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

func TestCrowdErrorSaysHaveOfNeed(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	addCrowd(t, s, 2)
	_, err := s.Claim("a", "x", 0)
	if err == nil || !strings.Contains(err.Error(), "have 2 of 3") {
		t.Fatalf("want 'have 2 of 3', got %v", err)
	}
}

func TestCannotClaimTwice(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	addCrowd(t, s, 3)
	if _, err := s.Claim("a", "x", 0); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Claim("a", "x", 0); !errors.Is(err, ErrSpent) {
		t.Fatalf("want ErrSpent, got %v", err)
	}
}

func TestWrongSecretFails(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "right")
	if _, err := s.Claim("wrong", "x", 0); !errors.Is(err, ErrUnknownNote) {
		t.Fatalf("want ErrUnknownNote, got %v", err)
	}
}

func TestOnlyFixedSizes(t *testing.T) {
	s := newApp(t)
	s.Deposit("alice", 50*USDC)
	if err := s.Lock("alice", 50*USDC, Fingerprint("s"), 0); !errors.Is(err, ErrBadDenom) {
		t.Fatalf("want ErrBadDenom, got %v", err)
	}
}

func TestCannotLockMoreThanCredited(t *testing.T) {
	s := newApp(t)
	s.Deposit("alice", 99*USDC)
	if err := s.Lock("alice", 100*USDC, Fingerprint("s"), 0); !errors.Is(err, ErrNoBalance) {
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
		if err := s.Lock(w, 1000*USDC, Fingerprint(w), 0); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Claim("a", "x", 0); !errors.Is(err, ErrCrowdSmall) {
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
	if _, err := s.Claim("a", "x", 0); !errors.Is(err, ErrSpent) {
		t.Fatalf("want ErrSpent after refund, got %v", err)
	}
}

func TestRefundedNotesDoNotCountAsCrowd(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "a")
	addCrowd(t, s, 3)
	// One of the three walks away; the crowd shrinks to 2.
	if _, err := s.Refund("crowd0", Fingerprint("crowd-secret0")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Claim("a", "x", 0); !errors.Is(err, ErrCrowdSmall) {
		t.Fatalf("want ErrCrowdSmall, got %v", err)
	}
}

func TestLeftoverCreditGoesBackToSameWallet(t *testing.T) {
	s := newApp(t)
	s.Deposit("alice", 150*USDC)
	if err := s.Lock("alice", 100*USDC, Fingerprint("a"), 0); err != nil {
		t.Fatal(err)
	}
	p, err := s.WithdrawCredit("alice")
	if err != nil || p.To != "alice" || p.Amount != 50*USDC {
		t.Fatalf("want 50 USDC back to alice, got %+v %v", p, err)
	}
	if _, err := s.WithdrawCredit("alice"); !errors.Is(err, ErrNoBalance) {
		t.Fatalf("want ErrNoBalance on second withdraw, got %v", err)
	}
}

func TestRefundWithoutSecret(t *testing.T) {
	s := newApp(t)
	lockFor(t, s, "alice", "lost-secret")
	lockFor(t, s, "bob", "bob-secret")
	// Alice lost her secret, but her wallet can still list her waiting notes.
	notes := s.NotesOf("alice")
	if len(notes) != 1 || notes[0].Denom != 100*USDC {
		t.Fatalf("want one 100 USDC note, got %+v", notes)
	}
	p, err := s.Refund("alice", notes[0].Fingerprint)
	if err != nil || p.To != "alice" || p.Amount != 100*USDC {
		t.Fatalf("refund failed: %+v %v", p, err)
	}
	if len(s.NotesOf("alice")) != 0 {
		t.Fatal("refunded note should no longer be listed")
	}
	if len(s.NotesOf("nobody")) != 0 {
		t.Fatal("a wallet with no notes should see nothing")
	}
}

func TestMinimumWaitBeforeClaim(t *testing.T) {
	cfg := baseConfig()
	cfg.MinWaitSecs = 3600
	s := newAppWith(t, cfg)
	s.Deposit("alice", 100*USDC)
	if err := s.Lock("alice", 100*USDC, Fingerprint("a"), 1000); err != nil {
		t.Fatal(err)
	}
	addCrowd(t, s, 3)
	// Locked at 1000, wait is 3600, so the earliest claim is at 4600.
	if _, err := s.Claim("a", "x", 4599); !errors.Is(err, ErrTooSoon) {
		t.Fatalf("want ErrTooSoon, got %v", err)
	}
	if _, err := s.Claim("a", "x", 4600); err != nil {
		t.Fatal(err)
	}
}

func TestFlaggedWalletIsRefundOnly(t *testing.T) {
	s := newApp(t)
	// Flagged before locking: cannot lock, but gets the deposit back.
	s.Flag("eve")
	s.Deposit("eve", 100*USDC)
	if err := s.Lock("eve", 100*USDC, Fingerprint("e"), 0); !errors.Is(err, ErrFlagged) {
		t.Fatalf("want ErrFlagged, got %v", err)
	}
	if p, err := s.WithdrawCredit("eve"); err != nil || p.To != "eve" {
		t.Fatalf("flagged wallet should get credit back: %+v %v", p, err)
	}
	// Flagged after locking: the note cannot be claimed, only refunded.
	lockFor(t, s, "mal", "m")
	addCrowd(t, s, 3)
	s.Flag("mal")
	if _, err := s.Claim("m", "x", 0); !errors.Is(err, ErrFlagged) {
		t.Fatalf("want ErrFlagged on claim, got %v", err)
	}
	if _, err := s.Refund("mal", Fingerprint("m")); err != nil {
		t.Fatalf("flagged wallet should still refund: %v", err)
	}
}

func TestInviteOnly(t *testing.T) {
	cfg := baseConfig()
	cfg.InviteOnly = true
	s := newAppWith(t, cfg)
	s.Deposit("alice", 100*USDC)
	if err := s.Lock("alice", 100*USDC, Fingerprint("a"), 0); !errors.Is(err, ErrNotInvited) {
		t.Fatalf("want ErrNotInvited, got %v", err)
	}
	s.Invite("alice")
	if err := s.Lock("alice", 100*USDC, Fingerprint("a"), 0); err != nil {
		t.Fatal(err)
	}
}

func TestLockCapPerWallet(t *testing.T) {
	cfg := baseConfig()
	cfg.MaxLockPerWallet = 200 * USDC
	s := newAppWith(t, cfg)
	s.Deposit("alice", 300*USDC)
	for i := 0; i < 2; i++ {
		if err := s.Lock("alice", 100*USDC, Fingerprint(fmt.Sprint(i)), 0); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.Lock("alice", 100*USDC, Fingerprint("third"), 0); !errors.Is(err, ErrOverCap) {
		t.Fatalf("want ErrOverCap, got %v", err)
	}
	// The money over the cap is not stuck: it goes back to alice.
	if p, err := s.WithdrawCredit("alice"); err != nil || p.Amount != 100*USDC {
		t.Fatalf("want 100 USDC back, got %+v %v", p, err)
	}
}
