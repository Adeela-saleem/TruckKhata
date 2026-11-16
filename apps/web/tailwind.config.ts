import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        // Desktop tall enough for a page laid out to fit one screen without scrolling.
        fit: { raw: '(min-width: 1024px) and (min-height: 620px)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'on-ink': 'rgb(var(--on-ink) / <alpha-value>)',
        good: 'rgb(var(--good) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
        // Semantic, theme-aware tokens (driven by CSS vars in index.css)
        canvas:  'rgb(var(--base) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          2:       'rgb(var(--surface-2) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong:  'rgb(var(--line-strong) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--text-1) / <alpha-value>)',
          muted:   'rgb(var(--text-2) / <alpha-value>)',
          subtle:  'rgb(var(--text-3) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong:  'rgb(var(--brand-strong) / <alpha-value>)',
          soft:    'rgb(var(--brand-soft) / <alpha-value>)',
        },
      },
      borderRadius: {
        xl: '14px',
      },
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.35rem' }],
        body: ['0.875rem', { lineHeight: '1.45rem' }],
        heading: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}

export default config
