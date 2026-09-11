export default function RatingStars({ value, label }: { value: number; label?: string }) {
  const rating = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0
  if (!rating) return null
  const description = label ?? `${Number(rating.toFixed(1))} out of 5 stars`
  return (
    <span role="img" aria-label={description} title={description} className="inline-flex shrink-0 items-center gap-0.5 text-[15px] leading-none">
      {Array.from({ length: Math.ceil(rating) }, (_, index) => (
        <span key={index} aria-hidden="true" className="relative inline-block text-[#ded8c9]">
          ★
          <span className="absolute inset-y-0 left-0 overflow-hidden text-[#ba9146]" style={{ width: `${Math.min(1, rating - index) * 100}%` }}>★</span>
        </span>
      ))}
    </span>
  )
}
