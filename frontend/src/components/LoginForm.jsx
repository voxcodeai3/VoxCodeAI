import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import GoogleAuthButton from "./GoogleAuthButton";

const inputBase =
  "w-full rounded-lg border bg-white/[0.04] py-3 pl-11 pr-11 text-sm text-cyan-50 placeholder-slate-500 outline-none transition-all duration-300";

const inputNormal =
  "border-cyan-400/20 hover:border-cyan-400/35 focus:border-cyan-300/70 focus:bg-cyan-400/[0.06] focus:shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_22px_-4px_rgba(34,211,238,0.45)]";

const inputError =
  "border-rose-400/60 focus:border-rose-400/80 focus:shadow-[0_0_0_1px_rgba(251,113,133,0.4),0_0_22px_-4px_rgba(251,113,133,0.5)]";

const iconBase =
  "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300";

function FieldIcon({ icon, error }) {
  const Icon = icon;
  return (
    <Icon
      className={`${iconBase} ${error ? "text-rose-400" : "text-cyan-300/60"}`}
    />
  );
}

function FieldError({ message }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function LoginForm({ onInteraction }) {
  const { login } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState(null);
  const [loginMode, setLoginMode] = useState("student");
  const navigate = useNavigate();

  // New Modes
  const [mode, setMode] = useState("login"); // 'login', 'verify', 'forgot', 'reset'
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const update = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((err) => ({ ...err, [key]: undefined }));
  };

  const validate = () => {
    const err = {};
    if (!values.email.trim()) {
      err.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      err.email = "Please enter a valid email address.";
    }
    if (!values.password) {
      err.password = "Password cannot be empty.";
    } else if (values.password.length < 8) {
      err.password = "Password must contain at least 8 characters.";
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setFormError(null);

    try {
      const res = await api.post("/auth/login", {
        email: values.email.trim(),
        password: values.password,
        isAdminLogin: loginMode === "admin",
      });
      login({ token: res.data.token, user: res.data.user }, remember);
      setLoading(false);
      setDone(true);
      const isAdmin =
        res.data.user?.role === "admin" ||
        res.data.user?.role === "super_admin";
      const target = loginMode === "admin" && isAdmin ? "/admin" : "/voxcode";
      setTimeout(() => navigate(target, { replace: true }), 700);
    } catch (error) {
      setLoading(false);
      if (error.response?.data?.code === "EMAIL_UNVERIFIED") {
        setMode("verify");
        api
          .post("/auth/resend-verification", { email: values.email.trim() })
          .catch(() => {});
        setResendCooldown(60);
        setFormError(null);
      } else {
        setFormError(
          error.response?.data?.message || "Invalid email or password.",
        );
      }
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim())
      return setFormError("Enter verification code.");
    setLoading(true);
    setFormError(null);
    try {
      const res = await api.post("/auth/verify-email", {
        email: values.email.trim(),
        code: verificationCode.trim(),
      });
      setLoading(false);
      setDone(true);
      login({ token: res.data.token, user: res.data.user }, remember);
      setTimeout(() => navigate("/voxcode", { replace: true }), 1000);
    } catch (error) {
      setLoading(false);
      setFormError(error.response?.data?.message || "Verification failed.");
    }
  };

  const handleResendVerify = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post("/auth/resend-verification", {
        email: values.email.trim(),
      });
      setResendCooldown(60);
      setFormError(null);
    } catch (error) {
      setFormError(error.response?.data?.message || "Failed to resend code.");
    }
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    if (!values.email.trim())
      return setFormError("Enter your email address first.");
    setLoading(true);
    setFormError(null);
    try {
      await api.post("/auth/forgot-password", { email: values.email.trim() });
      setLoading(false);
      setMode("reset");
      setResendCooldown(60);
    } catch (error) {
      setLoading(false);
      setFormError(
        error.response?.data?.message || "Failed to request password reset.",
      );
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim() || !newPassword)
      return setFormError("Enter code and new password.");
    if (newPassword.length < 8)
      return setFormError("Password must be at least 8 characters.");
    setLoading(true);
    setFormError(null);
    try {
      await api.post("/auth/reset-password", {
        email: values.email.trim(),
        code: verificationCode.trim(),
        newPassword,
      });
      setLoading(false);
      setDone(true);
      setTimeout(() => {
        setMode("login");
        setDone(false);
        setVerificationCode("");
        setNewPassword("");
        setValues((v) => ({ ...v, password: "" }));
      }, 2000);
    } catch (error) {
      setLoading(false);
      setFormError(
        error.response?.data?.message || "Failed to reset password.",
      );
    }
  };

  const handleResendForgot = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post("/auth/forgot-password", { email: values.email.trim() });
      setResendCooldown(60);
      setFormError(null);
    } catch (error) {
      setFormError(error.response?.data?.message || "Failed to resend code.");
    }
  };

  if (mode === "verify") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <div className="text-center text-sm text-cyan-50 mb-2">
          <Mail className="h-8 w-8 mx-auto text-cyan-400 mb-3" />
          <p className="font-medium text-lg mb-1">Please verify your email</p>
          <p className="text-slate-400">
            Enter the 6-digit verification code we sent to <br />
            <span className="text-cyan-300 font-medium">{values.email}</span>.
          </p>
        </div>

        <div>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="_ _ _ _ _ _"
            className={`${inputBase} text-center text-2xl tracking-widest font-mono pl-4 pr-4 py-4`}
            maxLength={6}
          />
        </div>

        {formError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p>{formError}</p>
          </div>
        )}

        {done && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div>
              <p className="font-semibold">Verified</p>
              <p className="mt-0.5 text-emerald-300/80">
                Email verified successfully. Logging in...
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || done || !verificationCode}
          className="group relative overflow-hidden rounded-lg border border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 via-blue-500/25 to-cyan-500/25 py-3.5 text-sm font-semibold tracking-[0.2em] text-cyan-50 uppercase transition-all duration-300 hover:scale-[1.02] hover:border-cyan-300/80 hover:from-cyan-400/40 hover:via-blue-400/40 hover:to-cyan-400/40 active:scale-[0.99] disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
              </>
            ) : (
              "Verify Email"
            )}
          </span>
        </button>

        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Back to login
          </button>
          <button
            type="button"
            onClick={handleResendVerify}
            disabled={resendCooldown > 0}
            className="text-sm text-cyan-300/80 hover:text-cyan-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? `Resend Code in ${resendCooldown}s`
              : "Resend Code"}
          </button>
        </div>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={handleForgotRequest} className="flex flex-col gap-4">
        <div className="text-center text-sm text-cyan-50 mb-2">
          <KeyRound className="h-8 w-8 mx-auto text-amber-400 mb-3" />
          <p className="font-medium text-lg mb-1">Reset Password</p>
          <p className="text-slate-400">
            Enter your email address to receive a password reset code.
          </p>
        </div>

        <div>
          <input
            type="email"
            value={values.email}
            onChange={update("email")}
            placeholder="Enter your email"
            className={`${inputBase} ${errors.email ? inputError : inputNormal}`}
          />
          <FieldIcon icon={Mail} error={errors.email} />
        </div>

        {formError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p>{formError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !values.email}
          className="group relative overflow-hidden rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-amber-500/25 py-3.5 text-sm font-semibold tracking-[0.2em] text-amber-50 uppercase transition-all duration-300 hover:scale-[1.02] hover:border-amber-300/80 hover:from-amber-400/40 hover:via-orange-400/40 hover:to-amber-400/40 active:scale-[0.99] disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending...
              </>
            ) : (
              "Send Reset Code"
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("login");
            setFormError(null);
          }}
          className="text-sm text-slate-400 hover:text-white transition-colors mt-2 text-center"
        >
          Back to login
        </button>
      </form>
    );
  }

  if (mode === "reset") {
    return (
      <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
        <div className="text-center text-sm text-cyan-50 mb-2">
          <Lock className="h-8 w-8 mx-auto text-amber-400 mb-3" />
          <p className="font-medium text-lg mb-1">Create New Password</p>
          <p className="text-slate-400">
            Enter the 6-digit code sent to <br />
            <span className="text-cyan-300 font-medium">
              {values.email}
            </span>{" "}
            and your new password.
          </p>
        </div>

        <div>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="6-digit code"
            className={`${inputBase} text-center tracking-widest font-mono`}
            maxLength={6}
          />
        </div>

        <div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className={inputBase}
            />
            <FieldIcon icon={Lock} />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300/60 transition-colors hover:text-cyan-200"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {formError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p>{formError}</p>
          </div>
        )}

        {done && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-0.5 text-emerald-300/80">
                Password updated. Redirecting to login...
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || done || !verificationCode || !newPassword}
          className="group relative overflow-hidden rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-amber-500/25 py-3.5 text-sm font-semibold tracking-[0.2em] text-amber-50 uppercase transition-all duration-300 hover:scale-[1.02] hover:border-amber-300/80 hover:from-amber-400/40 hover:via-orange-400/40 hover:to-amber-400/40 active:scale-[0.99] disabled:cursor-not-allowed"
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </span>
        </button>

        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Back to login
          </button>
          <button
            type="button"
            onClick={handleResendForgot}
            disabled={resendCooldown > 0}
            className="text-sm text-amber-300/80 hover:text-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? `Resend Code in ${resendCooldown}s`
              : "Resend Code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-cyan-400/20 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setLoginMode("student")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginMode === "student" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_-2px_rgba(34,211,238,0.5)]" : "text-slate-400 hover:text-slate-300"}`}
          aria-pressed={loginMode === "student"}
        >
          Student
        </button>
        <button
          type="button"
          onClick={() => setLoginMode("admin")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${loginMode === "admin" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_-2px_rgba(34,211,238,0.5)]" : "text-slate-400 hover:text-slate-300"}`}
          aria-pressed={loginMode === "admin"}
        >
          Admin
        </button>
      </div>

      <div>
        <input
          type="email"
          value={values.email}
          onChange={update("email")}
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
            type={showPassword ? "text" : "password"}
            value={values.password}
            onChange={update("password")}
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
            aria-label={showPassword ? "Hide password" : "Show password"}
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
                ? "border-cyan-300/70 bg-cyan-400/25 shadow-[0_0_12px_-2px_rgba(34,211,238,0.7)]"
                : "border-cyan-400/25 bg-white/[0.04]"
            }`}
          >
            <span
              className={`absolute h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                remember
                  ? "left-[18px] bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                  : "left-0.5 bg-slate-500"
              }`}
            />
          </span>
          Remember me
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("forgot");
            setFormError(null);
          }}
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
        Don't have an account?{" "}
        <Link
          to="/signup"
          className="text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}

export default LoginForm;
