/** "TLP-1234", "tlp 1234" and "TLP1234" are the same truck or case. */
export function referenceKey(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Names compare without caring about case or extra spaces. */
export function nameKey(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
