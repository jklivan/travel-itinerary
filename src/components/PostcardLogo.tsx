import Image from 'next/image'

// The round Postcard stamp logo. Every page shows it through this component, so a new logo only needs
// a new file here (the browser and iPhone app icons are separate: src/app/icon.png, src/app/apple-icon.png
// and ios/App/App/Assets.xcassets).
export const LOGO_SRC = '/brand/postcard-stamp-logo.png'

export default function PostcardLogo({ size, alt = '', className, priority }: { size: number; alt?: string; className?: string; priority?: boolean }) {
  return <Image src={LOGO_SRC} alt={alt} width={size} height={size} priority={priority} className={className} />
}
