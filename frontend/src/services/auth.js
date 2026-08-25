const TOKEN_KEY = 'voxcode_token'
const USER_KEY = 'voxcode_user'

function readItem(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key)
}

export function getToken() {
  return readItem(TOKEN_KEY)
}

export function getStoredAuth() {
  const token = readItem(TOKEN_KEY)
  if (!token) return null

  let user = null
  try {
    user = JSON.parse(readItem(USER_KEY))
  } catch {
    user = null
  }

  return { token, user }
}

export function setStoredAuth({ token, user }, remember = true) {
  clearStoredAuth()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}