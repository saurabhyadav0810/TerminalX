import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"

function App() {

  const editorRef = useRef(null)
  const [ username, setUsername ] = useState(() => {
    return new URLSearchParams(window.location.search).get("username") || ""
  })
  const [ users, setUsers ] = useState([])

  const ydoc = useMemo(() => new Y.Doc(), [])
  const yText = useMemo(() => ydoc.getText("monaco"), [ ydoc ])
  const yOutput = useMemo(() => ydoc.getText("output"), [ ydoc ])

  const [output, setOutput] = useState("")
  const handleMount = (editor) => {
    editorRef.current = editor

    new MonacoBinding(
      yText,
      editorRef.current.getModel(),
      new Set([ editorRef.current ]),
    )
  }

const runCode = async () => {

  const code = editorRef.current.getValue()

  try {

    const response = await fetch("/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    })

    const data = await response.json()

    yOutput.delete(0, yOutput.length)
    yOutput.insert(0, data.output)
    setOutput(data.output)

  } catch (e) {
    yOutput.delete(0, yOutput.length)
    yOutput.insert(0, "Error running code")
    setOutput("Error running code")
  }

}


  const handleJoin = (e) => {
    e.preventDefault()
    setUsername(e.target.username.value)
    window.history.pushState({}, "", "?username=" + e.target.username.value)



  }

  useEffect(() => {

    console.log(username)

    if (username) {

      const provider = new SocketIOProvider("/", "monaco", ydoc, {
        autoConnect: true,
      })

      provider.awareness.setLocalStateField("user", { username })


      const states = Array.from(provider.awareness.getStates().values())

      console.log(states)

      setUsers(states.filter(state => state.user && state.user.username).map(state => state.user))

      provider.awareness.on("change", () => {
        const states = Array.from(provider.awareness.getStates().values())
        setUsers(states.filter(state => state.user && state.user.username).map(state => state.user))
      })

      // Listen to output changes from other users
      yOutput.observe(() => {
        setOutput(yOutput.toString())
      })

      function handleBeforeUnload() {
        provider.awareness.setLocalStateField("user", null)
      }

      window.addEventListener("beforeunload", handleBeforeUnload)


      return () => {
        provider.disconnect()
        window.removeEventListener("beforeunload", handleBeforeUnload)
      }
    }
  }, [
    username,
    ydoc,
    yOutput
  ])

  if (!username) {
    return (
      <main className="h-screen w-full bg-gray-950 flex flex-col">
        <header
          className="bg-gray-900 border-b border-gray-700 p-4"
        >
          <h1 className="text-3xl font-bold text-amber-50">TerminalX</h1>
        </header>
        <div className="flex-1 flex gap-4 p-4 items-center justify-center">
          <form
            onSubmit={handleJoin}
            className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Enter your username"
              className="p-2 rounded-lg bg-gray-800 text-white"
              name="username"
            />
            <button
              className="p-2 rounded-lg bg-amber-50 text-gray-950 font-bold"
            >
              Join
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main
      className="h-screen w-full bg-gray-950 flex flex-col"
    >
      <header
        className="bg-gray-900 border-b border-gray-700 p-4"
      >
        <h1 className="text-3xl font-bold text-amber-50">Terminal</h1>
      </header>
      <div className="flex gap-4 p-4 flex-1">
        <aside
          className="h-full w-1/4 bg-amber-50 rounded-lg "
        >
        <h2 className="text-2xl font-bold p-4 border-b border-gray-300">Users</h2>
        <ul className="p-4">
          {users.map((user) => (
            <li key={user.username} className="p-2 bg-gray-800 text-white rounded mb-2">
              {user.username}
            </li>
          ))}
        </ul>

      </aside>
      <section className="w-3/4 bg-neutral-800 rounded-lg overflow-hidden flex flex-col">
        <div className="p-2 bg-black flex justify-end border-b border-gray-600">
          <button
            onClick={runCode}
            className="bg-green-500 px-4 py-2 rounded text-white"
          >
            Run
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            defaultValue="// some comment"
            theme="vs-dark"
            onMount={handleMount}
          />
        </div>

        <div className="h-40 bg-black text-green-400 p-4 overflow-auto border-t border-gray-600">
          <pre>{output}</pre>
        </div>
      </section>

      </div>
    </main>
  )
}

export default App