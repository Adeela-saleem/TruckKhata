export function formatCompact(n: number): string {
  if (Math.abs(n) < 1000) return n.toLocaleString()
  if (Math.abs(n) < 1_000_000) {
    const v = n / 1000
    return `${v % 1 === 0 ? v : v.toFixed(1)}K`
  }
  const v = n / 1_000_000
  return `${v % 1 === 0 ? v : v.toFixed(1)}M`
}

export const sharePct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '0%')
