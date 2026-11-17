import mongoose from "mongoose"

const permissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  access: {
    type: String,
    enum: ["read", "write"],
    default: "read",
  },
})

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: [50, "Room name cannot exceed 50 characters"],
    },
    language: {
      type: String,
      default: "javascript",
    },
    roomPassword: {
      type: String,
      required: [true, "Room password is required"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permissions: [permissionSchema],
  },
  { timestamps: true }
)

// Helper: check if a user has access to a room
// Works whether owner/user is a raw ObjectId OR a populated object { _id, ... }
roomSchema.methods.getUserAccess = function (userId) {
  const userIdStr = userId.toString()

  // Extract real ID — populated owner is { _id, username, email }, raw owner is ObjectId
  const ownerId = (this.owner?._id ?? this.owner).toString()

  // Owner always has full write access
  if (ownerId === userIdStr) return "write"

  // Check explicit permission entries
  const perm = this.permissions.find((p) => {
    const permUserId = (p.user?._id ?? p.user).toString()
    return permUserId === userIdStr
  })
  return perm ? perm.access : null
}

const Room = mongoose.model("Room", roomSchema)
export default Room
