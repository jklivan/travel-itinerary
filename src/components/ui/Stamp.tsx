// The postage-stamp label: "Must go!" on trip cards and "Must do!" on places. Coloured paper with a dashed white
// edge inside; the dashes are drawn in globals.css (.stamp) so every side shows on every phone.
export default function Stamp({ label, color, small = false, className = '', ...rest }: { label: string; color: string; small?: boolean; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...rest} className={`stamp ${small ? 'stamp-sm' : ''} ${className}`} style={{ backgroundColor: color }}><span className="stamp-inner">{label}</span></span>
}
