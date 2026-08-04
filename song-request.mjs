const MAX_QUERY_LENGTH = 120

export function extractSongRequest(comment) {
  const text = String(comment ?? "").trim()
  const match = text.match(/^\[\s*([^\[\]\r\n]+?)\s*\]$/u)
  if (!match) return null

  const query = match[1].replace(/\s+/gu, " ").trim()
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) return null

  return query
}
