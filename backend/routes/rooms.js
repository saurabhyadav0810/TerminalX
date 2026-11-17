import express from "express"
import {
  createRoom,
  joinRoom,
  myRooms,
  getRoom,
  updatePermission,
} from "../controllers/roomController.js"
import { verifyToken } from "../middleware/auth.js"

const router = express.Router()

// All routes require authentication
router.use(verifyToken)

router.post("/", createRoom)                                   // Create room
router.get("/mine", myRooms)                                   // My rooms
router.post("/:roomId/join", joinRoom)                         // Join by password
router.get("/:roomId", getRoom)                                // Get room info
router.put("/:roomId/permissions/:userId", updatePermission)   // Set read/write

export default router
