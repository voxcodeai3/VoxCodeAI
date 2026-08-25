import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { getStoredAuth, clearStoredAuth } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const token = auth?.token

    if (!token) {
      setLoading(false)
      return
    }

    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return
        setAuth({ token, user: res.data.user })
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        clearStoredAuth()
        setAuth(null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(({ token, user }, remember = true) => {
    const storage = remember ? localStorage : sessionStorage
    clearStoredAuth()
    storage.setItem('voxcode_token', token)
    storage.setItem('voxcode_user', JSON.stringify(user))
    setAuth({ token, user })
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    setAuth(null)
  }, [])

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: !!auth?.user,
      loading,
      login,
      logout,
    }),
    [auth, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}