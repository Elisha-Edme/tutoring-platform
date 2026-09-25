export default function StarRating({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  if (reviewCount === 0) {
    return <span className="text-xs text-gray-400">No reviews yet</span>
  }
  const full = Math.round(rating)
  return (
    <span className="text-xs text-gray-500">
      {'★'.repeat(Math.min(full, 5))}{'☆'.repeat(Math.max(0, 5 - full))} {rating.toFixed(1)}
      {typeof reviewCount === 'number' && reviewCount > 0 && ` (${reviewCount} review${reviewCount === 1 ? '' : 's'})`}
    </span>
  )
}
