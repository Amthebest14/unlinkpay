export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'unlinkpay-theme'

export function savedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

// "system" removes the pin so the device setting (prefers-color-scheme) decides.
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}
