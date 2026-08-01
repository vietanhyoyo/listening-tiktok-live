import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import { Server as SocketServer } from "socket.io"
import { ControlEvent, TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3001)
const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, { cors: { origin: true, credentials: true } })

const rawDefaults = JSON.parse(
  await readFile(path.join(__dirname, "public/data/default.json"), "utf8"),
)

const defaultSongs = rawDefaults.map((song, index) => ({
  ...song,
  id: song.videoId,
  votes: 0,
  requestedBy: [],
  isDefault: true,
  addedAt: index,
}))

let queue = []
let currentSong = defaultSongs[0] || null
let defaultCursor = defaultSongs.length > 1 ? 1 : 0
let liveConnection = null
let liveState = {
  connected: false,
  connecting: false,
  uniqueId: "",
  roomId: "",
  error: "",
}
let recentRequest = null
let songStartedAt = Date.now()
const pendingSearches = new Map()

function sortQueue() {
  queue.sort((a, b) => b.votes - a.votes || a.addedAt - b.addedAt)
}

function fallbackQueue() {
  if (!defaultSongs.length) return []
  return Array.from({ length: Math.min(10, defaultSongs.length) }, (_, offset) => {
    const song = defaultSongs[(defaultCursor + offset) % defaultSongs.length]
    return { ...song, fallbackPosition: offset + 1 }
  }).filter((song) => song.videoId !== currentSong?.videoId)
}

function publicState() {
  const usingDefaults = queue.length === 0
  return {
    currentSong,
    queue: usingDefaults ? fallbackQueue() : queue,
    usingDefaults,
    live: liveState,
    recentRequest,
    songStartedAt,
  }
}

function broadcastState() {
  io.emit("room-state", publicState())
}

function normalizeTitle(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*(official|audio|mv|lyrics?|video)[^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function findFirstVideoRenderer(value) {
  if (!value || typeof value !== "object") return null
  if (value.videoRenderer?.videoId) return value.videoRenderer
  for (const child of Object.values(value)) {
    const found = findFirstVideoRenderer(child)
    if (found) return found
  }
  return null
}

function readRuns(value) {
  return value?.simpleText || value?.runs?.map((run) => run.text).join("") || ""
}

function extractInitialData(html) {
  for (const marker of ["var ytInitialData = ", "window[\"ytInitialData\"] = ", "ytInitialData = "]) {
    const markerIndex = html.indexOf(marker)
    if (markerIndex < 0) continue
    const start = html.indexOf("{", markerIndex + marker.length)
    if (start < 0) continue

    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < html.length; index += 1) {
      const char = html[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === "\\") escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === "{") depth += 1
      else if (char === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1))
    }
  }
  throw new Error("Không đọc được kết quả tìm kiếm YouTube")
}

async function searchWithDataApi(query) {
  if (!process.env.YOUTUBE_API_KEY) return null
  const params = new URLSearchParams({
    part: "snippet",
    maxResults: "1",
    type: "video",
    q: query,
    key: process.env.YOUTUBE_API_KEY,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  if (!response.ok) throw new Error("YouTube Data API từ chối yêu cầu")
  const item = (await response.json()).items?.[0]
  if (!item) return null
  return {
    videoId: item.id.videoId,
    title: item.snippet.title,
    author: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
    duration: "YouTube",
  }
}

async function searchYouTube(query) {
  const apiResult = await searchWithDataApi(query)
  if (apiResult) return apiResult

  const params = new URLSearchParams({ search_query: `${query} official audio`, hl: "vi", gl: "VN" })
  const response = await fetch(`https://www.youtube.com/results?${params}`, {
    headers: {
      "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  })
  if (!response.ok) throw new Error("Không thể kết nối tới YouTube")
  const renderer = findFirstVideoRenderer(extractInitialData(await response.text()))
  if (!renderer) throw new Error(`Không tìm thấy “${query}” trên YouTube`)
  const videoId = renderer.videoId
  const thumbnails = renderer.thumbnail?.thumbnails || []
  return {
    videoId,
    title: readRuns(renderer.title) || query,
    author: readRuns(renderer.ownerText) || readRuns(renderer.longBylineText) || "YouTube",
    thumbnailUrl: thumbnails.at(-1)?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: readRuns(renderer.lengthText) || "YouTube",
  }
}

async function addSongRequest(query, user = {}) {
  const cleanQuery = query.trim().replace(/^@+\s*/, "").slice(0, 120)
  if (cleanQuery.length < 2) return

  const queryKey = normalizeTitle(cleanQuery)
  let searchPromise = pendingSearches.get(queryKey)
  if (!searchPromise) {
    searchPromise = searchYouTube(cleanQuery).finally(() => pendingSearches.delete(queryKey))
    pendingSearches.set(queryKey, searchPromise)
  }

  const result = await searchPromise
  const existing = queue.find(
    (song) => song.videoId === result.videoId || normalizeTitle(song.title) === normalizeTitle(result.title),
  )
  const requester = {
    id: user.uniqueId || user.userId || "tiktok-user",
    nickname: user.nickname || user.uniqueId || "TikTok user",
    avatar: user.avatar || "",
  }

  if (existing) {
    existing.votes += 1
    if (!existing.requestedBy.some((entry) => entry.id === requester.id)) {
      existing.requestedBy.push(requester)
    }
  } else {
    queue.push({
      ...result,
      id: result.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${result.videoId}`,
      votes: 1,
      requestedBy: [requester],
      isDefault: false,
      addedAt: Date.now(),
    })
  }

  recentRequest = { query: cleanQuery, user: requester.nickname, at: Date.now() }
  sortQueue()
  broadcastState()
  io.emit("request-result", { ok: true, title: result.title, user: requester.nickname })
}

async function disconnectTikTok() {
  const connection = liveConnection
  liveConnection = null
  if (connection) {
    try {
      await connection.disconnect()
    } catch {
      // The socket may already be closed.
    }
  }
  liveState = { connected: false, connecting: false, uniqueId: "", roomId: "", error: "" }
  broadcastState()
}

async function connectTikTok(input) {
  const uniqueId = String(input || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, "")
    .replace(/\/live.*$/i, "")
    .replace(/^@/, "")

  if (!uniqueId) throw new Error("Hãy nhập TikTok ID của phiên live")
  if (liveConnection) await disconnectTikTok()

  liveState = { connected: false, connecting: true, uniqueId, roomId: "", error: "" }
  broadcastState()
  const connection = new TikTokLiveConnection(uniqueId, { processInitialData: false })
  liveConnection = connection

  connection.on(WebcastEvent.CHAT, (data) => {
    const comment = String(data.comment || "").trim()
    const match = comment.match(/^@\s*(.{2,})$/u)
    if (!match) return
    addSongRequest(match[1], {
      uniqueId: data.user?.uniqueId,
      userId: data.user?.userId,
      nickname: data.user?.nickname,
      avatar: data.user?.profilePicture?.urls?.[0] || data.user?.avatarThumb?.urlList?.[0],
    }).catch((error) => io.emit("request-result", { ok: false, message: error.message }))
  })

  connection.on(ControlEvent.DISCONNECTED, () => {
    if (liveConnection !== connection) return
    liveConnection = null
    liveState = { ...liveState, connected: false, connecting: false, roomId: "", error: "Phiên live đã ngắt kết nối" }
    broadcastState()
  })

  connection.on(ControlEvent.ERROR, (error) => {
    if (liveConnection !== connection) return
    liveState = { ...liveState, error: error?.message || "Kết nối TikTok gặp lỗi" }
    broadcastState()
  })

  try {
    const state = await connection.connect()
    if (liveConnection !== connection) return
    liveState = {
      connected: true,
      connecting: false,
      uniqueId,
      roomId: String(state.roomId || ""),
      error: "",
    }
    broadcastState()
  } catch (error) {
    if (liveConnection === connection) liveConnection = null
    liveState = {
      connected: false,
      connecting: false,
      uniqueId,
      roomId: "",
      error: error?.message || "Không thể kết nối TikTok Live",
    }
    broadcastState()
    throw error
  }
}

function playNext() {
  if (queue.length) {
    sortQueue()
    currentSong = queue.shift()
  } else if (defaultSongs.length) {
    currentSong = defaultSongs[defaultCursor % defaultSongs.length]
    defaultCursor = (defaultCursor + 1) % defaultSongs.length
  }
  songStartedAt = Date.now()
  broadcastState()
}

io.on("connection", (socket) => {
  socket.emit("room-state", publicState())

  socket.on("connect-tiktok", async (uniqueId, callback = () => {}) => {
    try {
      await connectTikTok(uniqueId)
      callback({ ok: true })
    } catch (error) {
      callback({ ok: false, message: error?.message || "Kết nối thất bại" })
    }
  })

  socket.on("disconnect-tiktok", async () => disconnectTikTok())
  socket.on("song-ended", ({ videoId } = {}) => {
    if (videoId && videoId !== currentSong?.videoId) return
    playNext()
  })

  if (process.env.NODE_ENV !== "production") {
    socket.on("demo-request", ({ query, user } = {}, callback = () => {}) => {
      addSongRequest(query || "", { uniqueId: user || "demo", nickname: user || "demo" })
        .then(() => callback({ ok: true }))
        .catch((error) => callback({ ok: false, message: error.message }))
    })
  }
})

app.use(express.json())
app.get("/api/health", (_request, response) => response.json({ ok: true, live: liveState }))
// Keep large source media in /public instead of duplicating it in /dist at build time.
app.use(express.static(path.join(__dirname, "public")))
app.use(express.static(path.join(__dirname, "dist")))
app.get(/.*/, (_request, response, next) => {
  response.sendFile(path.join(__dirname, "dist/index.html"), (error) => (error ? next() : undefined))
})

httpServer.listen(PORT, () => {
  console.log(`Listening room server is running at http://localhost:${PORT}`)
})
