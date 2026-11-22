let csrf = ''
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}
export function setCsrf(value: string) { csrf = value }
function expired(status: number, token: string, path = '') {
  if (status === 401 && token === csrf && !['/auth/me', '/auth/login', '/auth/register', '/auth/change-password'].includes(path)) window.dispatchEvent(new Event('asklearn-session-expired'))
}
export async function api(path: string, options: RequestInit = {}) {
  const token = csrf
  const res = await fetch('/api' + path, {
    ...options, credentials: 'same-origin',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'X-CSRF-Token': token, ...options.headers },
  })
  const data = await res.json().catch(() => ({}))
  expired(res.status, token, path)
  if (!res.ok) throw new ApiError(typeof data.detail === 'string' ? data.detail : 'The request failed. Please try again.', res.status)
  return data
}
export function uploadFile(file: File, progress: (n: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const token = csrf
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/documents')
    xhr.setRequestHeader('X-CSRF-Token', token)
    xhr.upload.onprogress = e => { if (e.lengthComputable) progress(Math.round(e.loaded / e.total * 100)) }
    xhr.onload = () => {
      expired(xhr.status, token)
      let data: any = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* friendly message below */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new Error(data.detail || 'Upload failed. Please try again.'))
    }
    xhr.onerror = () => reject(new Error('Connection lost. Please try uploading again.'))
    xhr.timeout = 90000
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try a smaller file.'))
    const body = new FormData(); body.append('file', file); xhr.send(body)
  })
}
export async function streamChat(body: any, signal: AbortSignal, onEvent: (event: string, data: any) => void) {
  const token = csrf
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(body), signal })
  expired(res.status, token)
  if (!res.ok) { const data = await res.json(); throw new Error(data.detail || 'Chat failed.') }
  if (!res.body) throw new Error('Streaming is unavailable in this browser.')
  const reader = res.body.getReader(), decoder = new TextDecoder()
  let buffer = '', completed = false
  const consume = (frame: string) => {
    const lines = frame.split('\n'), kind = lines.find(l => l.startsWith('event:'))?.slice(6).trim() || 'token'
    const payload = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n')
    if (payload) { onEvent(kind, JSON.parse(payload)); if (kind === 'done') completed = true }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
      let end: number
      while ((end = buffer.indexOf('\n\n')) !== -1) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 2) }
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
    if (!completed) throw new Error('The response was interrupted. Please try again.')
  } finally { reader.releaseLock() }
}
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
}
