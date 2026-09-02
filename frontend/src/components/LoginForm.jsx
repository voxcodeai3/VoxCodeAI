import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import GoogleAuthButton from './GoogleAuthButton'

const inputBase =
  'w-full rounded-lg border bg-white/[0.04] py-3 pl-11 pr-11 text-sm text-cyan-50 placeholder-slate-500 outline-none transition-all duration-300'

const inputNormal =
  'border-cyan-400/20 hover:border-cyan-400/35 focus:border-cyan-300/70 focus:bg-cyan-400/[0.06] focus:shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_22px_-4px_rgba(34,211,238,0.45)]'

const inputError =
  'border-rose-400/60 focus:border-rose-400/80 focus:shadow-[0_0_0_1px_rgba(251,113,133,0.4),0_0_22px_-4px_rgba(251,113,133,0.5)]'

const iconBase =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300'

function FieldIcon({ icon, error }) {
  const Icon = icon
  return (
    <Icon
      className={`${iconBase} ${error ? 'text-rose-400' : 'text-cyan-300/60'}`}
    />
  )
}

function FieldError({ message }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  )
}

function LoginForm({ onInteraction }) {
  const { login } = useAuth()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState(null)
  const [loginMode, setLoginMode] = useState('student')
  const navigate = useNavigate()

  const update = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const err = {}
    if (!values.email.trim()) {
      err.email = 'Please enter your email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      err.email = 'Please enter a valid email address.'
    }
    if (!values.password) {
      err.password = 'Password cannot be empty.'
    } else if (values.password.length < 8) {
      err.password = 'Password must contain at least 8 characters.'
    }
    setErrors(err)
    return Object.keys(err).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setFormError(null)

    try {
      const res = await api.post('/auth/login', {
        email: values.email.trim(),
        password: values.password,
        isAdminLogin: loginMode === 'admin',
      })
      login({ token: res.data.token, user: res.data.user }, remember)
      setLoading(false)
      setDone(true)
      const isAdmin = res.data.user?.role === 'admin' || res.data.user?.role === 'super_admin'
      const target = loginMode === 'admin' && isAdmin ? '/admin' : '/voxcode'
      setTimeout(() => navigate(target, { replace: true }), 700)
    } catch (error) {
      setLoading(false)
      setFormError(
        error.response?.data?.message || 'Invalid email or password.',
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-cyan-400/20 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setLoginMode('student')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginMode === 'student' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_-2px_rgba(34,211,238,0.5)]' : 'text-slate-400 hover:text-slate-300'}`}
          aria-pressed={loginMode === 'student'}
        >
          Student
        </button>
        <button
          type="button"
          onClick={() => setLoginMode('admin')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginMode === 'admin' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_-2px_rgba(34,211,238,0.5)]' : 'text-slate-400 hover:text-slate-300'}`}
          aria-pressed={loginMode === 'admin'}
        >
          Admin
        </button>
      </div>

      <div>
        <input
          type="email"
          value={values.email}
          onChange={update('email')}
          onFocus={() => onInteraction?.(true)}
          onBlur={() => onInteraction?.(false)}
          placeholder="Enter your email"
          aria-label="Email"
          autoComplete="email"
          className={`${inputBase} ${errors.email ? inputError : inputNormal}`}
        />
        <FieldIcon icon={Mail} error={errors.email} />
        {errors.email && <FieldError message={errors.email} />}
      </div>

      <div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={values.password}
            onChange={update('password')}
            onFocus={() => onInteraction?.(true)}
            onBlur={() => onInteraction?.(false)}
            placeholder="Enter your password"
            aria-label="Password"
            autoComplete="current-password"
            className={`${inputBase} ${
              errors.password ? inputError : inputNormal
            }`}
          />
          <FieldIcon icon={Lock} error={errors.password} />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300/60 transition-colors hover:text-cyan-200"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && <FieldError message={errors.password} />}
      </div>

      {formError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <p>{formError}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setRemember((r) => !r)}
          className="group flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-cyan-200"
          aria-pressed={remember}
        >
          <span
            className={`relative flex h-5 w-9 items-center rounded-full border transition-all duration-300 ${
              remember
                ? 'border-cyan-300/70 bg-cyan-400/25 shadow-[0_0_12px_-2px_rgba(34,211,238,0.7)]'
                : 'border-cyan-400/25 bg-white/[0.04]'
            }`}
          >
            <span
              className={`absolute h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                remember
                  ? 'left-[18px] bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]'
                  : 'left-0.5 bg-slate-500'
              }`}
            />
          </span>
          Remember me
        </button>

        <button
          type="button"
          className="text-sm text-cyan-300/80 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline"
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={loading || done}
        className="group relative mt-2 overflow-hidden rounded-lg border border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 via-blue-500/25 to-cyan-500/25 py-3.5 text-sm font-semibold tracking-[0.2em] text-cyan-50 uppercase transition-all duration-300 hover:scale-[1.02] hover:border-cyan-300/80 hover:from-cyan-400/40 hover:via-blue-400/40 hover:to-cyan-400/40 hover:shadow-[0_0_34px_-4px_rgba(34,211,238,0.6)] active:scale-[0.99] disabled:cursor-not-allowed"
      >
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : done ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Access Granted
            </>
          ) : (
            <>
              Enter VoxCode
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </>
          )}
        </span>
      </button>

      <GoogleAuthButton />

      <p className="mt-1 text-center text-sm text-slate-400">
        Don't have an account?{' '}
        <Link
          to="/signup"
          className="text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  )
}

export default LoginForm