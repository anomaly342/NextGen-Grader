/** Up to two initials from the Display name, for an avatar: "Pimchanok Srisuk" → "PS". */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
