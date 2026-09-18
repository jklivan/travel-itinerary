export default function PostcardBrand({ className = '' }: { className?: string }) {
  return <span className={`postcard-brand ${className}`}>
    <span className="postcard-wordmark">Postcard<svg aria-hidden="true" viewBox="0 0 66 32" className="postcard-waves" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 7 Q17 -2 33 7 T64 7 M2 16 Q17 7 33 16 T64 16 M2 25 Q17 16 33 25 T64 25" />
    </svg></span>
    <span className="postcard-tagline">Travel lives here</span>
  </span>
}
