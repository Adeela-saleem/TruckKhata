import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const META_COLOR: Record<Theme, string> = { light: '#EEEFEC', dark: '#0A0B0C' }

function current(): Theme {
  if (typeof document === 'undefined') return 'light'
  const root = document.documentElement
  return root.classList.contains('dark') ? 'dark' : 'light'
}

/** Theme is applied to <html> by an inline script in index.html (no flash).
 *  This hook keeps React in sync and persists the choice. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem('theme', theme) } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', META_COLOR[theme])
  }, [theme])

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
  }
}
