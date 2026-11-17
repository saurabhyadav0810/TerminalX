import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, api } from "../context/AuthContext"

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
]

// ─── Small Components ─────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="text-xs text-gray-500 hover:text-amber-400 transition font-mono"
    >
      {copied ? "copied!" : text}
    </button>
  )
}

function RoomCard({ room, access, onOpen }) {
  const isOwner = access === "owner"
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate group-hover:text-amber-400 transition">
            {room.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-gray-600">ID:</span>
            <CopyButton text={room.roomId} />
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${
            isOwner
              ? "bg-amber-400/15 text-amber-400"
              : access === "write"
              ? "bg-green-500/15 text-green-400"
              : "bg-blue-500/15 text-blue-400"
          }`}
        >
          {isOwner ? "Owner" : access === "write" ? "Write" : "Read"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{room.language}</span>
        <button
          id={`open-${room.roomId}`}
          onClick={() => onOpen(room.roomId)}
          className="text-xs px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold rounded-lg transition"
        >
          Open →
        </button>
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", password: "", language: "javascript" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    if (!form.name.trim() || !form.password.trim()) {
      setError("Name and password are required.")
      return
    }
    setLoading(true)
    try {
      await onCreate(form)
      onClose()
    } catch (e) {
      setError(e.response?.data?.message || "Failed to create room")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-base font-bold text-white mb-5">Create Room</h2>

        {error && (
          <p className="text-red-400 text-xs mb-4 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Room name</label>
            <input
              id="create-name"
              type="text"
              placeholder="e.g. Backend Review"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Room password</label>
            <input
              id="create-password"
              type="password"
              placeholder="Share this with collaborators"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Language</label>
            <select
              id="create-language"
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            id="create-cancel"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg border border-gray-700 transition"
          >
            Cancel
          </button>
          <button
            id="create-confirm"
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-lg transition disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [rooms, setRooms] = useState({ owned: [], joined: [] })
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Join form state
  const [joinForm, setJoinForm] = useState({ roomId: "", password: "" })
  const [joinError, setJoinError] = useState("")
  const [joinLoading, setJoinLoading] = useState(false)

  useEffect(() => {
    api.get("/rooms/mine")
      .then((r) => setRooms(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async ({ name, password, language }) => {
    const res = await api.post("/rooms", { name, password, language })
    setRooms((r) => ({ ...r, owned: [res.data.room, ...r.owned] }))
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setJoinError("")
    if (!joinForm.roomId.trim() || !joinForm.password.trim()) {
      setJoinError("Room ID and password are required.")
      return
    }
    setJoinLoading(true)
    try {
      await api.post(`/rooms/${joinForm.roomId.trim().toUpperCase()}/join`, {
        password: joinForm.password,
      })
      navigate(`/room/${joinForm.roomId.trim().toUpperCase()}`)
    } catch (e) {
      setJoinError(e.response?.data?.message || "Could not join room.")
    } finally {
      setJoinLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const totalRooms = rooms.owned.length + rooms.joined.length

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">TerminalX</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">@{user?.username}</span>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="text-xs text-gray-600 hover:text-gray-300 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">My Rooms</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalRooms === 0 ? "No rooms yet" : `${totalRooms} room${totalRooms !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            id="new-room-btn"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-lg transition"
          >
            + New Room
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left — Room list */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : totalRooms === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
                <p className="text-gray-600 text-sm">No rooms yet.</p>
                <p className="text-gray-700 text-xs mt-1">Create one or join using a Room ID.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.owned.length > 0 && (
                  <>
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-2">
                      Created by you
                    </p>
                    {rooms.owned.map((room) => (
                      <RoomCard
                        key={room._id}
                        room={room}
                        access="owner"
                        onOpen={(id) => navigate(`/room/${id}`)}
                      />
                    ))}
                  </>
                )}

                {rooms.joined.length > 0 && (
                  <>
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-medium mt-4 mb-2">
                      Joined rooms
                    </p>
                    {rooms.joined.map((room) => {
                      const perm = room.permissions?.find(
                        (p) => (p.user?._id || p.user) === user?.id
                      )
                      return (
                        <RoomCard
                          key={room._id}
                          room={room}
                          access={perm?.access || "read"}
                          onOpen={(id) => navigate(`/room/${id}`)}
                        />
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right — Join a room */}
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-1">Join a Room</h2>
              <p className="text-xs text-gray-500 mb-4">
                Enter the Room ID and password shared by the creator
              </p>

              {joinError && (
                <p className="text-red-400 text-xs mb-3 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                  {joinError}
                </p>
              )}

              <form onSubmit={handleJoin} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Room ID</label>
                  <input
                    id="join-room-id"
                    type="text"
                    placeholder="e.g. XK4B9Z"
                    value={joinForm.roomId}
                    onChange={(e) =>
                      setJoinForm((f) => ({ ...f, roomId: e.target.value.toUpperCase() }))
                    }
                    maxLength={6}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition font-mono tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input
                    id="join-password"
                    type="password"
                    placeholder="Room password"
                    value={joinForm.password}
                    onChange={(e) => setJoinForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                  />
                </div>
                <button
                  id="join-submit"
                  type="submit"
                  disabled={joinLoading}
                  className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {joinLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Join Room"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}
