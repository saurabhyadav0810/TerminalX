import jwt from "jsonwebtoken"
import User from "../models/User.js"

export const verifyToken = async (req, res, next) => {
  try {
    let token

    // Check httpOnly cookie first (preferred)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token
    }
    // Fallback: Authorization header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select("-password")

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
      })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    })
  }
}

// Socket.IO token verifier (returns user or throws)
export const verifySocketToken = async (token) => {
  if (!token) throw new Error("No token provided")
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  const user = await User.findById(decoded.id).select("-password")
  if (!user) throw new Error("User not found")
  return user
}
