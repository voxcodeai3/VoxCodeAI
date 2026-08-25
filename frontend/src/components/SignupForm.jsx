import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import api from '../services/api'
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

function SignupForm() {
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState(null)
  const navigate = useNavigate()

  const update = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const err = {}
    if (!values.name.trim()) err.name = 'Name cannot be empty.'
    if (!values.email.trim()) {
      err.email = 'Email cannot be empty.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      err.email = 'Enter a valid email address.'
    }
    if (!values.password) {
      err.password = 'Password cannot be empty.'
    } else if (values.password.length < 8) {
      err.password = 'Password must contain at least 8 characters.'
    }
    if (!values.confirm) {
      err.confirm = 'Confirm your password.'
    } else if (values.confirm !== values.password) {
      err.confirm = 'Passwords do not match.'
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
      await api.post('/auth/register', {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      })
      setLoading(false)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (error) {
      setLoading(false)
      const message =
        error.response?.data?.message ||
        'Unable to create your account right now. Please try again.'
      if (message.toLowerCase().includes('email')) {
        setErrors((err) => ({ ...err, email: message }))
      } else {
        setFormError(message)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <input
          type="text"
          value={values.name}
          onChange={update('name')}
          placeholder="Enter your name"
          aria-label="Full Name"
          className={`${inputBase} ${errors.name ? inputError : inputNormal}`}
        />
        <FieldIcon icon={User} error={errors.name} />
        {errors.name && <FieldError message={errors.name} />}
      </div>

      <div>
        <input
          type="email"
          value={values.email}
          onChange={update('email')}
          placeholder="Enter your email"
          aria-label="Email"
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
            placeholder="Create a password"
            aria-label="Password"
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

      <div>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={values.confirm}
            onChange={update('confirm')}
            placeholder="Confirm your password"
            aria-label="Confirm Password"
            className={`${inputBase} ${
              errors.confirm ? inputError : inputNormal
            }`}
          />
          <FieldIcon icon={Lock} error={errors.confirm} />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300/60 transition-colors hover:text-cyan-200"
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.confirm && <FieldError message={errors.confirm} />}
      </div>

      {done && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div>
            <p className="font-semibold">Success</p>
            <p className="mt-0.5 text-emerald-300/80">
              Account created successfully. Redirecting to login...
            </p>
          </div>
        </div>
      )}

      {formError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <p>{formError}</p>
        </div>
      )}

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
              Creating your VoxCode account...
            </>
          ) : done ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Account Ready
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </>
          )}
        </span>
      </button>

      <GoogleAuthButton />

      <p className="mt-1 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}

export default SignupForm