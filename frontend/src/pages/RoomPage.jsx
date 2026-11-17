import { useRef, useMemo, useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { useAuth, api } from "../context/AuthContext"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(username) {
  return username?.[0]?.toUpperCase() || "?"
}

const AVATAR_COLORS = [
  "bg-amber-500", "bg-blue-500", "bg-green-500",
  "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-orange-500",
]

function avatarColor(username) {
  return AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

// ─── User item in sidebar ──────────────────────────────────────────────────────
function UserItem({ connectedUser, permission, isOwner, isCurrentUser, onSetPermission }) {
  const access = permission || "read"
  const isRoomOwner = connectedUser.isOwner

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition group">
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full ${avatarColor(connectedUser.username)} flex items-center justify-center text-xs font-bold text-white shrink-0 relative`}>
        {getInitials(connectedUser.username)}
        {/* Green online dot */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-900" />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">
          {connectedUser.username}
          {isCurrentUser && <span className="text-gray-600 text-xs ml-1">(you)</span>}
        </p>
      </div>

      {/* Permission — owner sees buttons, others see badge */}
      {isRoomOwner ? (
        <span className="text-xs text-amber-400 font-medium shrink-0">Owner</span>
      ) : isOwner ? (
        // Room owner can toggle permissions
        <div className="flex gap-1 shrink-0">
          <button
            id={`perm-read-${connectedUser.userId}`}
            onClick={() => onSetPermission(connectedUser.userId, "read")}
            className={`text-xs px-1.5 py-0.5 rounded font-medium transition ${
              access === "read"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            R
          </button>
          <button
            id={`perm-write-${connectedUser.userId}`}
            onClick={() => onSetPermission(connectedUser.userId, "write")}
            className={`text-xs px-1.5 py-0.5 rounded font-medium transition ${
              access === "write"
                ? "bg-green-600 text-white"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            W
          </button>
        </div>
      ) : (
        // Non-owners just see their access level
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
            access === "write"
              ? "text-green-400"
              : "text-blue-400"
          }`}
        >
          {access === "write" ? "Write" : "Read"}
        </span>
      )}
    </div>
  )
}

// ─── Room Page ─────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const editorRef = useRef(null)

  // Room state
  const [roomInfo, setRoomInfo] = useState(null)
  const [myAccess, setMyAccess] = useState(null) // "read" | "write"
  const [isRoomOwner, setIsRoomOwner] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [isLoadingRoom, setIsLoadingRoom] = useState(true)

  // Permission map: userId → "read"|"write"
  const [permissionsMap, setPermissionsMap] = useState({})

  // Connected users from socket: [{ userId, username, isOwner }]
  const [connectedUsers, setConnectedUsers] = useState([])

  // Output
  const [output, setOutput] = useState("")
  const [isRunning, setIsRunning] = useState(false)

  // YJS
  const ydoc = useMemo(() => new Y.Doc(), [])
  const yText = useMemo(() => ydoc.getText("monaco"), [ydoc])
  const yOutput = useMemo(() => ydoc.getText("output"), [ydoc])

  // ─── Load room on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get(`/rooms/${roomId}`)
      .then((res) => {
        const { room, access } = res.data
        setRoomInfo(room)
        setMyAccess(access)

        const ownerId = room.owner?._id || room.owner
        setIsRoomOwner(ownerId === user?.id)

        // Build permissions map from room data
        const map = {}
        room.permissions?.forEach((p) => {
          const uid = p.user?._id || p.user
          if (uid) map[uid.toString()] = p.access
        })
        setPermissionsMap(map)
      })
      .catch((err) => {
        setLoadError(err.response?.data?.message || "Failed to load room.")
      })
      .finally(() => setIsLoadingRoom(false))
  }, [roomId, user?.id])

  // ─── Socket.IO + YJS setup ────────────────────────────────────────────────
  useEffect(() => {
    if (!roomInfo || !user) return

    const ownerId = (roomInfo.owner?._id || roomInfo.owner)?.toString()

    const provider = new SocketIOProvider("/", roomId, ydoc, { autoConnect: true })

    // ── WHY AWARENESS? ────────────────────────────────────────────────────────
    // Custom socket events (user:join / room:users) were unreliable because
    // autoConnect:true fires BEFORE listeners are attached. YJS awareness is
    // guaranteed to work — it uses the same internal socket as the editor sync.
    // If text syncs between users, awareness syncs too.
    // ─────────────────────────────────────────────────────────────────────────

    // Broadcast our own presence to every peer in this room
    provider.awareness.setLocalStateField("user", {
      userId: user.id,
      username: user.username,
    })

    // Rebuild connected-users list whenever any peer joins/leaves/updates
    const updateConnectedUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      const users = states
        .filter((s) => s.user?.username && s.user?.userId)
        .map((s) => ({
          userId: s.user.userId,
          username: s.user.username,
          isOwner: s.user.userId === ownerId,
        }))
      // Always include at least the current user (self may appear immediately)
      if (users.length > 0) setConnectedUsers(users)
    }

    provider.awareness.on("change", updateConnectedUsers)
    updateConnectedUsers() // fire once immediately for initial state

    // ── Permission events via socket (bonus — works when socket is ready) ────
    // We use a try/catch so a socket API mismatch never breaks the whole room
    try {
      const socket = provider.socket
      if (socket) {
        const emitJoin = () => socket.emit("user:join", { roomId })
        if (socket.connected) emitJoin()
        socket.on("connect", emitJoin)

        socket.on("room:permission_updated", ({ userId, access }) => {
          setPermissionsMap((prev) => ({ ...prev, [userId]: access }))
          if (userId === user.id) setMyAccess(access)
        })
      }
    } catch (_) {
      // Permission events degrade gracefully — owner's sidebar still works
    }

    // ── YJS output sync ────────────────────────────────────────────────────
    yOutput.observe(() => setOutput(yOutput.toString()))

    return () => {
      // Clear our presence so peers see us as gone
      provider.awareness.setLocalStateField("user", null)
      provider.awareness.off("change", updateConnectedUsers)
      provider.disconnect()
    }
  }, [roomInfo, user, ydoc, yOutput, roomId])

  // ─── Monaco mount ─────────────────────────────────────────────────────────
  const handleMount = useCallback(
    (editor) => {
      editorRef.current = editor
      new MonacoBinding(yText, editor.getModel(), new Set([editor]))
    },
    [yText]
  )

  // ─── Run code ────────────────────────────────────────────────────────────
  const runCode = async () => {
    if (!editorRef.current || myAccess !== "write") return
    setIsRunning(true)
    const code = editorRef.current.getValue()
    try {
      const res = await fetch("/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      yOutput.delete(0, yOutput.length)
      yOutput.insert(0, data.output || "")
      setOutput(data.output || "")
    } catch {
      const msg = "Error connecting to server"
      yOutput.delete(0, yOutput.length)
      yOutput.insert(0, msg)
      setOutput(msg)
    } finally {
      setIsRunning(false)
    }
  }

  // ─── Set permission (owner only) ─────────────────────────────────────────
  const handleSetPermission = async (targetUserId, access) => {
    try {
      await api.put(`/rooms/${roomId}/permissions/${targetUserId}`, { access })
      setPermissionsMap((prev) => ({ ...prev, [targetUserId]: access }))
    } catch (e) {
      console.error("Permission update failed:", e.response?.data?.message)
    }
  }

  // ─── Loading / error states ───────────────────────────────────────────────
  if (isLoadingRoom) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-4xl">🚫</p>
        <h2 className="text-lg font-bold text-white">Access Denied</h2>
        <p className="text-gray-500 text-sm max-w-xs">{loadError}</p>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-sm rounded-lg transition"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const isReadOnly = myAccess === "read"

  return (
    <div className="h-screen w-full bg-gray-950 flex flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            id="back-btn"
            onClick={() => navigate("/")}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            ← Dashboard
          </button>
          <span className="text-gray-700">|</span>
          <span className="text-sm font-semibold text-white">{roomInfo?.name}</span>
          <span className="text-xs text-gray-700 font-mono">{roomId}</span>
        </div>

        <div className="flex items-center gap-3">
          {isReadOnly ? (
            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
              Read only
            </span>
          ) : (
            <button
              id="run-btn"
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60"
            >
              {isRunning ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "▶ Run"
              )}
            </button>
          )}
        </div>
      </header>

      {/* ─── Body (Sidebar + Editor) ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="px-3 py-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Connected ({connectedUsers.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {connectedUsers.length === 0 ? (
              <p className="text-xs text-gray-700 text-center mt-6 px-3">
                Waiting for others to join…
              </p>
            ) : (
              connectedUsers.map((u) => (
                <UserItem
                  key={u.userId}
                  connectedUser={u}
                  permission={
                    u.isOwner ? "write" : permissionsMap[u.userId] || "read"
                  }
                  isOwner={isRoomOwner}
                  isCurrentUser={u.userId === user?.id}
                  onSetPermission={handleSetPermission}
                />
              ))
            )}
          </div>

          {/* Legend for owner */}
          {isRoomOwner && connectedUsers.some((u) => !u.isOwner) && (
            <div className="px-3 py-2 border-t border-gray-800">
              <p className="text-xs text-gray-700">R = Read · W = Write</p>
            </div>
          )}
        </aside>

        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Read-only notice */}
          {isReadOnly && (
            <div className="px-4 py-1.5 bg-blue-950/30 border-b border-blue-900/40 text-blue-400 text-xs">
              You have read-only access — ask the owner to grant write permission
            </div>
          )}

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={roomInfo?.language || "javascript"}
              defaultValue={`// ${roomInfo?.name}\n`}
              theme="vs-dark"
              onMount={handleMount}
              options={{
                readOnly: isReadOnly,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineNumbers: "on",
                cursorStyle: isReadOnly ? "underline" : "line",
              }}
            />
          </div>

          {/* Output */}
          <div className="h-32 flex flex-col border-t border-gray-800 shrink-0">
            <div className="flex items-center justify-between px-4 py-1 bg-gray-900/60 border-b border-gray-800">
              <span className="text-xs text-gray-600 font-medium">Output</span>
              {output && (
                <button
                  id="clear-output"
                  onClick={() => {
                    yOutput.delete(0, yOutput.length)
                    setOutput("")
                  }}
                  className="text-xs text-gray-700 hover:text-gray-500 transition"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto px-4 py-2 bg-gray-950">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {output || (
                  <span className="text-gray-800">
                    {isReadOnly
                      ? "Output appears here when code is run"
                      : "Press ▶ Run to execute"}
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
