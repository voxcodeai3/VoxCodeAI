import { useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react'
import VoxLogo from '../components/VoxLogo'
import FuturisticBackground from '../components/FuturisticBackground'
import { useAuth } from '../context/AuthContext'

function OAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()

  const token = params.get('token')
  const error = params.get('error')
  const id = params.get('id')
  const name = params.get('name') || 'Explorer'
  const email = params.get('email') || ''
  const avatar = params.get('avatar') || null
  const authProvider = params.get('authProvider') || 'google'

  useEffect(() => {
    if (!token || error) return
    login({ token, user: { id, name, email, avatar, authProvider } }, true)
    const timer = setTimeout(() => navigate('/voxcode', { replace: true }), 1100)
    return () => clearTimeout(timer)
  }, [token, error, id, name, email, login, navigate])

  let status = 'success'
  let message = 'Authentication successful...'
  if (error) {
    status = 'error'
    message = error
  } else if (!token) {
    status = 'error'
    message = 'Unable to authenticate with Google. Please try again.'
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FuturisticBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10">
        <VoxLogo />

        <div className="vox-box-glow relative mt-10 w-full rounded-2xl border border-cyan-400/15 bg-[#040a14]/80 p-8 text-center backdrop-blur-2xl animate-fade-up sm:p-10">
          <div className="vox-line absolute inset-x-10 top-0 h-px" />
          <div className="absolute inset-x-10 bottom-0 h-px opacity-40 vox-line" />

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 vox-core-shadow">
                <ShieldCheck className="h-7 w-7 text-emerald-300" />
              </div>
              <p className="text-lg font-semibold text-emerald-200">{message}</p>
              <p className="text-sm text-slate-300">Redirecting to VoxCode...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10">
                <AlertTriangle className="h-7 w-7 text-rose-300" />
              </div>
              <p className="text-sm leading-relaxed text-rose-200">{message}</p>
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 via-blue-500/25 to-cyan-500/25 px-5 py-2.5 text-sm font-semibold tracking-[0.15em] text-cyan-50 uppercase transition-all duration-300 hover:scale-[1.02] hover:border-cyan-300/80 hover:shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)] active:scale-[0.99]"
              >
                <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OAuthCallback