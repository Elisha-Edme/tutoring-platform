import StarRating from './StarRating'

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

interface Props {
  rating: number
  comment: string
  date: string
  identityLabel?: string
}

export default function ReviewCard({ rating, comment, date, identityLabel }: Props) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        {identityLabel
          ? <p className="text-sm font-medium text-gray-700">{identityLabel}</p>
          : <span />}
        <span className="text-xs text-gray-400 shrink-0">{formatRelativeDate(date)}</span>
      </div>
      <StarRating rating={rating} />
      {comment && (
        <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3 mt-2">
          &ldquo;{comment}&rdquo;
        </p>
      )}
    </div>
  )
}
