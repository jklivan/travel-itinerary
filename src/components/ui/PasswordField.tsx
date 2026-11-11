'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Every password box (sign in, sign up, reset password): a field with an eye button inside to show or hide what's typed.
export default function PasswordField(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false)
  return <div className="relative">
    <input {...props} type={shown ? 'text' : 'password'} className={`field pr-12 ${props.className ?? ''}`} />
    <button type="button" onClick={() => setShown(value => !value)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} className="btn-icon absolute right-1.5 top-1/2 -translate-y-1/2 !border-0 !bg-transparent text-muted">{shown ? <EyeOff size={18} /> : <Eye size={18} />}</button>
  </div>
}
