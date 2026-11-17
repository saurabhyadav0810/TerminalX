import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import cors from "cors"
import vm from "vm"
import cookieParser from "cookie-parser"

import connectDB from "./config/db.js"
import authRoutes from "./routes/auth.js"
import roomRoutes from "./routes/rooms.js"
import { verifySocketToken } from "./middleware/auth.js"

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB()

const app = express()

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.static("public"))
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes)
app.use("/api/rooms", roomRoutes)

// ─── Code Execution ──────────────────────────────────────────────────────────
app.post("/run", async (req, res) => {
  try {
    const { code } = req.body
    let output = ""
    const sandbox = {
      console: { log: (...args) => { output += args.join(" ") + "\n" } },
    }
    vm.createContext(sandbox)
    vm.runInContext(code, sandbox)
    res.json({ success: true, output })
  } catch (error) {
    res.json({ success: false, output: error.message })
  }
})

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ message: "ok", success: true })
})

// ─── HTTP Server & Socket.IO ──────────────────────────────────────────────────
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Make io available to controllers (for emitting permission updates)
app.set("io", io)

// ─── Socket.IO Auth Middleware ────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie
        ?.split(";")
        .find((c) => c.trim().startsWith("token="))
        ?.split("=")[1]

    const user = await verifySocketToken(token)
    socket.user = user
    next()
  } catch (err) {
    next(new Error("Authentication failed: " + err.message))
  }
})

// ─── YJS Sync (handles document awareness + sync automatically) ───────────────
const ySocketIO = new YSocketIO(io)
ySocketIO.initialize()

// ─── Socket Events ────────────────────────────────────────────────────────────
// Connected users list is managed entirely by YJS awareness (client-side).
// The server only needs the socket room for routing permission_updated events.
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.user?.username || "unknown"} (${socket.id})`)

  // Client emits this to join the socket.io room so it can receive
  // room:permission_updated events emitted by the controller
  socket.on("user:join", ({ roomId }) => {
    if (!roomId) return
    socket.join(`room:${roomId}`)
    socket.data.roomId = roomId
    console.log(`✅ ${socket.user?.username} subscribed to room ${roomId}`)
  })

  socket.on("disconnect", () => {
    console.log(`🔌 ${socket.user?.username} disconnected`)
  })
})

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
})