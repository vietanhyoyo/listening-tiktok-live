import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import {
  AudioLines,
  ChevronRight,
  CircleAlert,
  Crown,
  FastForward,
  Heart,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Radio,
  Rewind,
  SkipForward,
  Unplug,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react"
import { io } from "socket.io-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const socket = io({ autoConnect: true })

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return "0:00"
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
}

function Equalizer({ active = true, dark = false }) {
  return (
    <span className={cn("equalizer", !active && "is-paused", dark && "is-dark")} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

const YouTubeAudioPlayer = forwardRef(function YouTubeAudioPlayer(
  { song, audioEnabled, volume, onAudioState, onProgress, onEnded },
  ref,
) {
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const currentIdRef = useRef("")
  const handlersRef = useRef({ onAudioState, onProgress, onEnded })
  handlersRef.current = { onAudioState, onProgress, onEnded }

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      if (readyRef.current) playerRef.current?.seekTo?.(Math.max(0, seconds), true)
    },
    play() {
      if (readyRef.current) playerRef.current?.playVideo?.()
    },
    pause() {
      if (readyRef.current) playerRef.current?.pauseVideo?.()
    },
  }), [])

  useEffect(() => {
    let cancelled = false

    function createPlayer() {
      if (cancelled || readyRef.current || !window.YT?.Player) return
      playerRef.current = new window.YT.Player("youtube-audio-player", {
        height: "1",
        width: "1",
        playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event) => {
            readyRef.current = true
            event.target.setVolume(volume)
            if (currentIdRef.current) event.target.loadVideoById(currentIdRef.current)
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) handlersRef.current.onAudioState(true)
            if (event.data === window.YT.PlayerState.PAUSED) handlersRef.current.onAudioState(false)
            if (event.data === window.YT.PlayerState.ENDED) handlersRef.current.onEnded(currentIdRef.current)
          },
          onError: () => handlersRef.current.onEnded(currentIdRef.current),
        },
      })
    }

    if (window.YT?.Player) createPlayer()
    else {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        createPlayer()
      }
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        document.head.appendChild(script)
      }
    }

    const timer = window.setInterval(() => {
      if (!readyRef.current || !playerRef.current?.getCurrentTime) return
      const current = playerRef.current.getCurrentTime() || 0
      const duration = playerRef.current.getDuration() || 0
      handlersRef.current.onProgress({ current, duration })
    }, 500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      playerRef.current?.destroy?.()
      playerRef.current = null
      readyRef.current = false
    }
  }, [])

  useEffect(() => {
    currentIdRef.current = song?.videoId || ""
    if (!song?.videoId || !readyRef.current) return
    playerRef.current.loadVideoById(song.videoId)
    if (!audioEnabled) playerRef.current.pauseVideo()
  }, [song?.videoId])

  useEffect(() => {
    if (!readyRef.current) return
    if (audioEnabled) playerRef.current.playVideo()
    else playerRef.current.pauseVideo()
  }, [audioEnabled])

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume?.(volume)
  }, [volume])

  return (
    <div className="youtube-audio" aria-hidden="true">
      <div id="youtube-audio-player" />
    </div>
  )
})

function SongArtwork({ song, size = "md", rank }) {
  return (
    <div className={cn("song-artwork", `artwork-${size}`)}>
      {song?.thumbnailUrl ? <img src={song.thumbnailUrl} alt="" loading="lazy" /> : <Music2 />}
      {rank && <span className="artwork-rank">{String(rank).padStart(2, "0")}</span>}
    </div>
  )
}

function VoteAvatars({ song }) {
  const voters = song.requestedBy || []
  if (!voters.length) return <span className="auto-label">Auto playlist</span>
  return (
    <div className="vote-avatars" aria-label={`${voters.length} người yêu cầu`}>
      {voters.slice(0, 3).map((voter, index) => (
        <span key={`${voter.id}-${index}`} style={{ zIndex: 3 - index }}>
          {voter.avatar ? <img src={voter.avatar} alt="" /> : <UserRound />}
        </span>
      ))}
      <small>{voters[0]?.nickname}</small>
    </div>
  )
}

function TopSong({ song, rank, fallback }) {
  return (
    <article className={cn("top-song", rank === 1 && "first-place")}>
      <SongArtwork song={song} rank={rank} />
      <div className="song-copy">
        <div className="song-title-row">
          <h3>{song.title}</h3>
          {rank === 1 && !fallback && <Crown className="crown" />}
        </div>
        <p>{song.author || "YouTube"}</p>
        <VoteAvatars song={song} />
      </div>
      <div className={cn("vote-count", fallback && "is-auto")}>
        {fallback ? <AudioLines /> : <Heart fill="currentColor" />}
        <strong>{fallback ? "AUTO" : song.votes}</strong>
        {!fallback && <span>vote</span>}
      </div>
    </article>
  )
}

function QueueSong({ song, rank, fallback }) {
  return (
    <article className="queue-song">
      <span className="queue-rank">{String(rank).padStart(2, "0")}</span>
      <SongArtwork song={song} size="sm" />
      <div className="song-copy">
        <h3>{song.title}</h3>
        <p>{song.author || "YouTube"}</p>
      </div>
      <span className={cn("queue-votes", fallback && "is-auto")}>
        {fallback ? <AudioLines /> : <Heart fill="currentColor" />}
        {fallback ? "Auto" : song.votes}
      </span>
    </article>
  )
}

function QueueMarquee({ songs, fallback }) {
  const repeatedSongs = songs.length > 1 ? [...songs, ...songs] : songs
  return (
    <div className="queue-marquee">
      <div className={cn("marquee-track", songs.length < 2 && "no-animation")}>
        {repeatedSongs.map((song, index) => (
          <QueueSong
            key={`${song.videoId}-${index}`}
            song={song}
            rank={(index % songs.length) + 7}
            fallback={fallback}
          />
        ))}
      </div>
    </div>
  )
}

function ConnectDialog({ open, onOpenChange, live, onConnect, onDisconnect }) {
  const [uniqueId, setUniqueId] = useState("")
  const [localError, setLocalError] = useState("")

  function submit(event) {
    event.preventDefault()
    const value = uniqueId.trim()
    if (!value) {
      setLocalError("Bạn chưa nhập TikTok ID")
      return
    }
    setLocalError("")
    onConnect(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="dialog-radio-icon">{live.connected ? <Unplug /> : <Radio />}</div>
        <DialogHeader>
          <Badge variant="secondary" className="w-fit">TikTok live</Badge>
          <DialogTitle>{live.connected ? "Phiên live đang bật" : "Kết nối phòng live"}</DialogTitle>
          <DialogDescription>
            {live.connected ? (
              <>Đang nhận bình luận từ <b>@{live.uniqueId}</b>. Bạn có thể ngắt kết nối ngay bên dưới.</>
            ) : (
              <>Nhập ID của tài khoản đang live. Mọi bình luận bắt đầu bằng <b>@Tên bài hát</b> sẽ được tìm trên YouTube và đưa vào bảng xếp hạng.</>
            )}
          </DialogDescription>
        </DialogHeader>
        {live.connected ? (
          <div className="connect-form">
            <div className="connection-status"><span /> Đang kết nối với @{live.uniqueId}</div>
            <Button type="button" variant="outline" className="w-full disconnect-button" onClick={onDisconnect}>
              <Unplug /> Ngắt kết nối live
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="connect-form">
            <label htmlFor="tiktok-id">TikTok ID</label>
            <div className="id-input-wrap">
              <span>@</span>
              <input
                id="tiktok-id"
                value={uniqueId}
                onChange={(event) => setUniqueId(event.target.value)}
                placeholder="tên_tài_khoản"
                autoComplete="off"
                autoCapitalize="none"
                disabled={live.connecting}
              />
            </div>
            {(localError || live.error) && (
              <p className="form-error"><CircleAlert /> {localError || live.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={live.connecting}>
              {live.connecting ? <LoaderCircle className="animate-spin" /> : <Radio />}
              {live.connecting ? "Đang kết nối…" : "Bật kết nối live"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function App() {
  const [room, setRoom] = useState({
    currentSong: null,
    queue: [],
    usingDefaults: true,
    live: { connected: false, connecting: false, uniqueId: "", error: "" },
  })
  const [stateLoaded, setStateLoaded] = useState(false)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(75)
  const [progress, setProgress] = useState({ current: 0, duration: 0 })
  const [notice, setNotice] = useState("")
  const playerControlsRef = useRef(null)

  useEffect(() => {
    const handleRoom = (value) => {
      setRoom(value)
      setStateLoaded(true)
    }
    const handleRequest = (value) => {
      setNotice(value.ok ? `${value.user} vừa bình chọn “${value.title}”` : value.message)
      window.setTimeout(() => setNotice(""), 4000)
    }
    socket.on("room-state", handleRoom)
    socket.on("request-result", handleRequest)
    socket.on("connect_error", () => setStateLoaded(true))
    return () => {
      socket.off("room-state", handleRoom)
      socket.off("request-result", handleRequest)
    }
  }, [])

  useEffect(() => {
    const openWithShortcut = (event) => {
      const target = event.target
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if (!isTyping && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "q") {
        event.preventDefault()
        setConnectDialogOpen(true)
      }
    }
    window.addEventListener("keydown", openWithShortcut)
    return () => window.removeEventListener("keydown", openWithShortcut)
  }, [])

  useEffect(() => {
    setProgress({ current: 0, duration: 0 })
  }, [room.currentSong?.videoId])

  const topSix = useMemo(() => room.queue.slice(0, 6), [room.queue])
  const remaining = useMemo(() => room.queue.slice(6), [room.queue])

  const connect = useCallback((uniqueId) => {
    setAudioEnabled(true)
    socket.emit("connect-tiktok", uniqueId)
  }, [])

  const disconnect = useCallback(() => socket.emit("disconnect-tiktok"), [])

  const togglePlayback = () => {
    setAudioEnabled((enabled) => !enabled)
  }

  const endSong = useCallback((videoId) => {
    socket.emit("song-ended", { videoId })
  }, [])

  const percentage = progress.duration > 0 ? Math.min(100, (progress.current / progress.duration) * 100) : 0
  const dialogOpen = stateLoaded && connectDialogOpen

  return (
    <div className="app-shell">
      <YouTubeAudioPlayer
        ref={playerControlsRef}
        song={room.currentSong}
        audioEnabled={audioEnabled}
        volume={volume}
        onAudioState={setPlaying}
        onProgress={setProgress}
        onEnded={endSong}
      />

      <header className="stream-stage">
        <video src="/assets/videostream1.mp4" autoPlay muted loop playsInline preload="auto" />
        <div className="stream-shade" />
        <div className="stream-caption">
          <span>LIVE STREAM</span>
          <strong>Nghe nhạc cùng nhau.</strong>
        </div>
      </header>

      <main>
        <section className="now-playing" aria-label="Bài hát đang phát">
          <SongArtwork song={room.currentSong} size="lg" />
          <div className="now-copy">
            <Badge variant="secondary"><Equalizer active={playing} /> Đang phát</Badge>
            <h1>{room.currentSong?.title || "Đang chuẩn bị phòng nhạc"}</h1>
            <p>{room.currentSong?.author || "ON AIR music room"}</p>
          </div>
          <div className="transport-buttons">
            <button onClick={() => playerControlsRef.current?.seekTo(progress.current - 10)} aria-label="Lùi 10 giây"><Rewind /></button>
            <button className="play-button" onClick={togglePlayback} aria-label={audioEnabled ? "Tạm dừng" : "Phát nhạc"}>
              {audioEnabled ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            </button>
            <button onClick={() => playerControlsRef.current?.seekTo(progress.current + 10)} aria-label="Tới 10 giây"><FastForward /></button>
            <button onClick={() => endSong(room.currentSong?.videoId)} aria-label="Bài tiếp theo"><SkipForward /></button>
          </div>
          <div className="player-progress">
            <input
              aria-label="Vị trí bài hát"
              type="range"
              min="0"
              max={progress.duration || 100}
              value={progress.duration ? progress.current : 0}
              onChange={(event) => playerControlsRef.current?.seekTo(Number(event.target.value))}
              style={{ "--progress": `${percentage}%` }}
            />
          </div>
          <div className="player-time">
            <small>{formatTime(progress.current)}</small>
            <div className="volume-control">
              <button
                onClick={() => setVolume((value) => (value > 0 ? 0 : 75))}
                aria-label={volume > 0 ? "Tắt âm lượng" : "Bật âm lượng"}
              >
                {volume > 0 ? <Volume2 /> : <VolumeX />}
              </button>
              <input
                aria-label="Âm lượng"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                style={{ "--volume": `${volume}%` }}
              />
            </div>
            <small>{progress.duration ? formatTime(progress.duration) : room.currentSong?.duration || "--:--"}</small>
          </div>
        </section>

        <section className="request-prompt">
          <span><Music2 /></span>
          <div>
            <p>nhập tên bài hát để thêm vào danh sách</p>
            <strong>Comment <b>@Tên bài hát</b> trên TikTok Live</strong>
          </div>
          <ChevronRight />
        </section>

        <section className="ranking-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE CHART</span>
              <h2>Top 6 bình chọn</h2>
            </div>
            <Badge variant={room.usingDefaults ? "outline" : "default"}>
              {room.usingDefaults ? "Tự động" : "Realtime"}
            </Badge>
          </div>

          {topSix.length ? (
            <div className="top-list">
              <div className="top-column">
                {topSix.slice(0, 3).map((song, index) => (
                  <TopSong key={`${song.videoId}-${index}`} song={song} rank={index + 1} fallback={room.usingDefaults} />
                ))}
              </div>
              <div className="top-column">
                {topSix.slice(3, 6).map((song, index) => (
                  <TopSong key={`${song.videoId}-${index + 3}`} song={song} rank={index + 4} fallback={room.usingDefaults} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-queue">
              <Music2 />
              <strong>Đang chờ bài hát đầu tiên</strong>
              <p>Playlist mặc định vẫn được phát trong lúc chờ bình chọn.</p>
            </div>
          )}
        </section>

        <section className="queue-section">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">UP NEXT</span>
              <h2>Tiếp theo trong hàng đợi</h2>
            </div>
            <span className="song-total">{Math.max(0, room.queue.length - 6)} bài</span>
          </div>
          {remaining.length ? (
            <QueueMarquee songs={remaining} fallback={room.usingDefaults} />
          ) : (
            <p className="queue-empty-copy">Các bài từ hạng 7 sẽ xuất hiện ở đây.</p>
          )}
        </section>

      </main>

      {notice && <div className="toast-notice"><Heart fill="currentColor" /> {notice}</div>}

      <ConnectDialog
        open={dialogOpen}
        onOpenChange={setConnectDialogOpen}
        live={room.live}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      {!stateLoaded && (
        <div className="loading-screen"><LoaderCircle className="animate-spin" /><span>Đang mở phòng nhạc…</span></div>
      )}
    </div>
  )
}

export default App
