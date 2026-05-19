import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { YSocketIO } from "y-socket.io/dist/server"
import cors from "cors"
import vm from "vm"

const app = express()


app.use(express.static("public"))

app.use(cors())
app.use(express.json())

app.use(express.static("public"))

const httpServer = createServer(app)

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const ySocketIO = new YSocketIO(io)
ySocketIO.initialize()




app.post("/run", async (req, res) => {

    try {

        const { code } = req.body

        let output = ""

        const sandbox = {
            console: {
                log: (...args) => {
                    output += args.join(" ") + "\n"
                }
            }
        }

        vm.createContext(sandbox)

        vm.runInContext(code, sandbox)

        res.json({
            success: true,
            output
        })

    } catch (error) {

        res.json({
            success: false,
            output: error.message
        })

    }

})



app.get('/health', (req, res) => {
    res.status(200).json({
        message: "ok",
        success: true
    })
})

httpServer.listen(3000, () => {
    console.log("Server is running on port 3000")
})