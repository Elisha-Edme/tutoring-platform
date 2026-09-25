// A curated palette (not raw random RGB, which reliably produces muddy
// combinations) — each tutor deterministically gets the same one every time,
// and neighboring cards in the grid still read as visually distinct.
const GRADIENTS = [
  'linear-gradient(135deg, #fda4af, #fdba74)', // rose -> orange
  'linear-gradient(135deg, #7dd3fc, #a5f3fc)', // sky -> cyan
  'linear-gradient(135deg, #c4b5fd, #f0abfc)', // violet -> fuchsia
  'linear-gradient(135deg, #86efac, #5eead4)', // green -> teal
  'linear-gradient(135deg, #fcd34d, #fca5a5)', // amber -> red
  'linear-gradient(135deg, #93c5fd, #c4b5fd)', // blue -> violet
  'linear-gradient(135deg, #f9a8d4, #fdba74)', // pink -> orange
  'linear-gradient(135deg, #5eead4, #93c5fd)', // teal -> blue
]

export function getTutorGradient(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return GRADIENTS[hash % GRADIENTS.length]
}
