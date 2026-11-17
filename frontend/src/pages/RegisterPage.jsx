import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setIsLoading(true)
    try {
      await register(form.username, form.email, form.password)
      navigate("/")
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Password strength indicator
  const strength = !form.password
    ? 0
    : form.password.length < 6
    ? 1
    : form.password.length < 10
    ? 2
    : 3

  const strengthLabel = ["", "Weak", "Good", "Strong"]
  const strengthColor = ["", "bg-red-500", "bg-yellow-400", "bg-green-500"]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="flex items-center px-8 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold text-white">TerminalX</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-1">Create your account ✨</h1>
              <p className="text-gray-400 text-sm">
                Join TerminalX and start collaborating in real-time
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2 bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="reg-username">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                  <input
                    id="reg-username"
                    name="username"
                    type="text"
                    placeholder="yourname"
                    value={form.username}
                    onChange={handleChange}
                    required
                    minLength={3}
                    maxLength={20}
                    className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">3–20 characters, letters and numbers</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="reg-email">
                  Email address
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="reg-password">
                  Password
                </label>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                />
                {/* Password strength bar */}
                {form.password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map((s) => (
                        <div
                          key={s}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            strength >= s ? strengthColor[strength] : "bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{strengthLabel[strength]}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="reg-confirm">
                  Confirm password
                </label>
                <input
                  id="reg-confirm"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition ${
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? "border-red-700"
                      : "border-gray-700"
                  }`}
                />
              </div>

              <button
                id="register-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold rounded-xl text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Account →"
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-600 mt-5">
            🔒 Your password is securely hashed — we never store it in plain text
          </p>
        </div>
      </div>
    </div>
  )
}
