'use client'

import { useState } from 'react'

export default function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hoverValue, setHoverValue] = useState(0)
  const display = hoverValue || value

  return (
    <div className="flex gap-1" onMouseLeave={() => setHoverValue(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHoverValue(n)}
          aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
          className="text-2xl leading-none text-amber-500 hover:scale-110 transition"
        >
          {n <= display ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}
