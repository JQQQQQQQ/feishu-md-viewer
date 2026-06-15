export function createHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function createUniqueHeadingIdFactory(): (text: string) => string {
  const slugCounts = new Map<string, number>();

  return (text: string): string => {
    const base = createHeadingId(text) || 'section';
    const current = slugCounts.get(base) ?? 0;
    const next = current + 1;
    slugCounts.set(base, next);
    return next === 1 ? base : `${base}-${next}`;
  };
}
