'use client'

import { useRef, useEffect, useState, Children } from 'react'

export default function HorizontalScrollFeed({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const items = Children.toArray(children)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function update() {
      const c = containerRef.current!
      const cRect = c.getBoundingClientRect()
      const center = cRect.left + cRect.width / 2
      const kids = Array.from(c.children) as HTMLElement[]
      let ci = 0, cd = Infinity
      kids.forEach((k, i) => {
        const kRect = k.getBoundingClientRect()
        const d = Math.abs(kRect.left + kRect.width / 2 - center)
        if (d < cd) { cd = d; ci = i }
      })
      setActiveIndex(ci)
    }

    el.addEventListener('scroll', update, { passive: true })
    update()
    return () => el.removeEventListener('scroll', update)
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex overflow-x-auto gap-4 pb-6 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
    >
      {items.map((child, i) => (
        <div
          key={i}
          className={`snap-center shrink-0 transition-all duration-300 ease-out ${
            i === activeIndex
              ? 'scale-105 opacity-100'
              : 'scale-90 opacity-55'
          }`}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
