import { sizedPhoto } from '@/lib/photoSizing'

// A person's profile photo, or their initials on navy when they haven't added one.
export default function UserAvatar({ name, image, size = 32, className = '' }: { name: string; image?: string | null; size?: number; className?: string }) {
  const initials = name.split(' ').filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase()
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }
  if (image) return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={sizedPhoto(image, 256)} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />
  </>
  return <span aria-hidden="true" style={style} className={`flex shrink-0 items-center justify-center rounded-full bg-[#4d6a8c] font-semibold text-white ${className}`}>{initials}</span>
}
