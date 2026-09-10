import { Children } from 'react'

export default function HorizontalScrollFeed({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex overflow-x-auto gap-4 pb-6 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
      {Children.toArray(children).map((child, i) => (
        <div key={i} className="snap-center shrink-0">
          {child}
        </div>
      ))}
    </div>
  )
}
