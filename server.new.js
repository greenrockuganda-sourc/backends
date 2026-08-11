import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || 8080)

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

const serveFile = async (filePath, res) => {
  try {
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': getContentType(filePath) })
    res.end(data)
  } catch (error) {
    res.writeHead(404)
    res.end('Not found')
  }
}

const backendBaseUrl = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || ''
const shouldProxyApi = backendBaseUrl.trim() !== ''

createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${port}`)
  const requestPath = requestUrl.pathname

  if (shouldProxyApi && requestPath.startsWith('/api')) {
    try {
      const proxyUrl = new URL(req.url, backendBaseUrl.trim()).toString()
      const headers = new Headers()

      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          const headerValue = Array.isArray(value) ? value.join(', ') : String(value)
          headers.set(name, headerValue)
        }
      }
      headers.delete('host')

      const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await req.arrayBuffer()
      const backendResponse = await fetch(proxyUrl, {
        method: req.method || 'GET',
        headers,
        body,
        redirect: 'manual',
      })

      const responseHeaders = {}
      backendResponse.headers.forEach((value, name) => {
        responseHeaders[name] = value
      })

      res.writeHead(backendResponse.status, responseHeaders)
      const responseBuffer = await backendResponse.arrayBuffer()
      res.end(Buffer.from(responseBuffer))
      return
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Bad gateway: unable to proxy request to backend.')
      return
    }
  }

  let filePath = path.join(distDir, requestPath)

  if (requestPath === '/' || requestPath === '') {
    filePath = path.join(distDir, 'index.html')
  }

  try {
    const fileStat = await import('node:fs/promises').then(({ stat }) => stat(filePath))
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }
    await serveFile(filePath, res)
  } catch {
    await serveFile(path.join(distDir, 'index.html'), res)
  }
}).listen(port, () => {
  // eslint-disable-next-line no-console
  if (shouldProxyApi) {
    console.log(`Server listening on port ${port} and proxying /api to ${backendBaseUrl}`)
  } else {
    console.log(`Server listening on port ${port}`)
  }
})
