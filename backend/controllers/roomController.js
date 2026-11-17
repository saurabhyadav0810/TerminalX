import bcrypt from "bcryptjs"
import { customAlphabet } from "nanoid"
import Room from "../models/Room.js"

// Generate short, easy-to-read 6-char room codes (no confusing chars like 0,O,1,I)
const generateRoomId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)

// ─── POST /api/rooms ─ Create a room with name + password ────────────────────
export const createRoom = async (req, res) => {
  try {
    const { name, password, language } = req.body

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: "Room name and password are required.",
      })
    }

    const roomPassword = await bcrypt.hash(password, 10)
    const roomId = generateRoomId()

    const room = await Room.create({
      roomId,
      name,
      language: language || "javascript",
      owner: req.user._id,
      roomPassword,
      permissions: [],
    })

    await room.populate("owner", "username email")

    res.status(201).json({ success: true, room })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── POST /api/rooms/:roomId/join ─ Join with password ───────────────────────
export const joinRoom = async (req, res) => {
  try {
    const { password } = req.body
    const room = await Room.findOne({ roomId: req.params.roomId })

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found. Check the Room ID." })
    }

    // Owner doesn't need password — they always have write access
    const ownerId = (room.owner._id ?? room.owner).toString()
    if (ownerId === req.user._id.toString()) {
      await room.populate("owner", "username email")
      return res.status(200).json({ success: true, access: "write", room })
    }

    // Verify password
    const match = await bcrypt.compare(password || "", room.roomPassword)
    if (!match) {
      return res.status(401).json({ success: false, message: "Incorrect room password." })
    }

    // Check if already a member
    const existing = room.permissions.find(
      (p) => (p.user._id ?? p.user).toString() === req.user._id.toString()
    )

    if (!existing) {
      // New member — default read access
      room.permissions.push({ user: req.user._id, access: "read" })
      await room.save()
    }

    const access = existing ? existing.access : "read"
    await room.populate("owner", "username email")

    res.status(200).json({ success: true, access, room })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── GET /api/rooms/mine ─ Rooms owned or joined ─────────────────────────────
export const myRooms = async (req, res) => {
  try {
    const owned = await Room.find({ owner: req.user._id }).populate("owner", "username email")
    const joined = await Room.find({ "permissions.user": req.user._id }).populate("owner", "username email")

    res.status(200).json({ success: true, owned, joined })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── GET /api/rooms/:roomId ─ Get room info (owner or member only) ────────────
export const getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate("owner", "username email")
      .populate("permissions.user", "username email")

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found." })
    }

    const access = room.getUserAccess(req.user._id)

    if (!access) {
      return res.status(403).json({
        success: false,
        message: "You need to join this room first. Ask for the Room ID and password.",
      })
    }

    res.status(200).json({ success: true, room, access })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── PUT /api/rooms/:roomId/permissions/:userId ─ Owner sets read/write ───────
export const updatePermission = async (req, res) => {
  try {
    const { access } = req.body

    if (!["read", "write"].includes(access)) {
      return res.status(400).json({
        success: false,
        message: "Access must be 'read' or 'write'.",
      })
    }

    const room = await Room.findOne({ roomId: req.params.roomId })

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found." })
    }

    const ownerId = (room.owner._id ?? room.owner).toString()
    if (ownerId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the room owner can change permissions.",
      })
    }

    const perm = room.permissions.find(
      (p) => (p.user._id ?? p.user).toString() === req.params.userId
    )

    if (!perm) {
      return res.status(404).json({
        success: false,
        message: "User is not a member of this room.",
      })
    }

    perm.access = access
    await room.save()

    // Notify all clients in this room about the permission change
    const io = req.app.get("io")
    if (io) {
      io.to(`room:${room.roomId}`).emit("room:permission_updated", {
        userId: req.params.userId,
        access,
      })
    }

    res.status(200).json({
      success: true,
      message: `Permission updated to ${access}.`,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
