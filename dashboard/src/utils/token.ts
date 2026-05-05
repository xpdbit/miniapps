const TOKEN_KEY = 'ftg_token'
const REMEMBER_KEY = 'ftg_remember'

function getStorage(rememberMe?: boolean): Storage {
  const remember = rememberMe ?? localStorage.getItem(REMEMBER_KEY) !== 'false'
  return remember ? localStorage : sessionStorage
}

export function getRememberMe(): boolean {
  return localStorage.getItem(REMEMBER_KEY) !== 'false'
}

export function setRememberMe(remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, 'true')
  } else {
    localStorage.setItem(REMEMBER_KEY, 'false')
  }
}

export const getToken = (): string | null => {
  const storage = getStorage()
  return storage.getItem(TOKEN_KEY)
}

export const setToken = (token: string): void => {
  const storage = getStorage()
  storage.setItem(TOKEN_KEY, token)
}

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}
