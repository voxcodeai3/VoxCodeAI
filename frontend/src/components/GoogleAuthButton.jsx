import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.62-.15-3.17-.42-4.68H24v9.12h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.62z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-400/20 to-cyan-400/25" />
      <span className="text-[11px] font-medium tracking-[0.35em] text-slate-400 uppercase">
        Or
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-400/20 to-cyan-400/25" />
    </div>
  )
}

function GoogleAuthButton() {
  const [loading, setLoading] = useState(false)

  const handleGoogle = () => {
    if (loading) return
    setLoading(true)
    window.location.href = `${API_BASE}/auth/google`
  }

  return (
    <>
      <OrDivider />
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold tracking-wide text-slate-100 transition-all duration-300 hover:scale-[1.01] hover:border-cyan-300/50 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_0_22px_-4px_rgba(34,211,238,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            Connecting to Google...
          </>
        ) : (
          <>
            <GoogleMark />
            Continue with Google
          </>
        )}
      </button>
    </>
  )
}

export default GoogleAuthButton