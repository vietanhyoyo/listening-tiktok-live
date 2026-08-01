import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Static media stays in /public and is served by Express in production.
  // This prevents a second 25 MB copy of the stream video inside /dist.
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": { target: "http://localhost:3001", ws: true },
      "/api": "http://localhost:3001",
      "/assets": "http://localhost:3001",
      "/data": "http://localhost:3001",
    },
  },
})
