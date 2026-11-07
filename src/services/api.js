export const API_URL = import.meta.env.VITE_API_URL || 'http://13.127.87.91:8080'

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options)
  const raw = await response.text()
  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { body = { error: raw } }
  if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`)
  return body
}

export function jsonOptions(token, method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }
}
