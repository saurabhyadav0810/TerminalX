import axios from "axios"
import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext(null)

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // send httpOnly cookies automatically
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: check if user is already logged in via cookie
  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const register = async (username, email, password) => {
    const res = await api.post("/auth/register", { username, email, password })
    setUser(res.data.user)
    return res.data
  }

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password })
    setUser(res.data.user)
    return res.data
  }

  const logout = async () => {
    await api.post("/auth/logout")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register, api }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export { api }
