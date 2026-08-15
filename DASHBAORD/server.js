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

createServer(async (req, res) => {
  const requestPath = new URL(req.url, `http://localhost:${port}`).pathname
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
  console.log(`Server listening on port ${port}`)
})
