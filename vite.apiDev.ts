import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'

type ApiModule = {
  GET?: (request: Request) => Promise<Response> | Response
  POST?: (request: Request) => Promise<Response> | Response
  PUT?: (request: Request) => Promise<Response> | Response
  PATCH?: (request: Request) => Promise<Response> | Response
  DELETE?: (request: Request) => Promise<Response> | Response
  default?: (request: Request) => Promise<Response> | Response
}

function resolveApiFile(apiRoot: string, pathname: string): string | null {
  const relative = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
  if (!relative || relative.includes('..')) return null

  const candidates = [
    path.join(apiRoot, `${relative}.js`),
    path.join(apiRoot, relative, 'index.js'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  // Dynamic segments: api/rotations/[id].js for /api/rotations/:id
  const parts = relative.split('/')
  for (let i = parts.length; i >= 1; i -= 1) {
    const staticParts = parts.slice(0, i - 1)
    const rest = parts.slice(i - 1)
    const dir = path.join(apiRoot, ...staticParts)
    if (!fs.existsSync(dir)) continue

    const entries = fs.readdirSync(dir)
    const dynamic = entries.find(
      (name) =>
        name.startsWith('[') &&
        name.endsWith('].js') &&
        !name.includes(']/'),
    )
    if (!dynamic) continue
    if (rest.length === 1) {
      const file = path.join(dir, dynamic)
      if (fs.existsSync(file)) return file
    }

    // Nested: [id]/comments.js for /api/rotations/:id/comments
    if (rest.length === 2) {
      const param = dynamic.slice(1, -4) // strip [ and ].js
      const nested = entries.find(
        (name) => name === `[${param}]/${rest[1]}.js` || name === `[${param}].${rest[1]}.js`,
      )
      // Also support file form: [id]/comments.js
      const flat = path.join(dir, `[${param}].${rest[1]}.js`)
      if (fs.existsSync(flat)) return flat
      if (nested) {
        const file = path.join(dir, nested)
        if (fs.existsSync(file)) return file
      }
    }
  }

  return null
}

async function readBody(req: Connect.IncomingMessage): Promise<Buffer | undefined> {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return undefined
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

async function writeResponse(
  res: Connect.ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    res.setHeader(key, value)
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  res.end(buffer)
}

/**
 * Serves Vercel-style `api/*.js` handlers during `vite` so local app can hit
 * the same online Supabase/Clerk backends configured in `.env.local`.
 */
export function vercelApiDev(apiRoot = path.resolve('api')): Plugin {
  let envLoaded = false

  const ensureEnv = (mode: string, root: string) => {
    if (envLoaded) return
    const env = loadEnv(mode, root, '')
    for (const [key, value] of Object.entries(env)) {
      if (process.env[key] === undefined) process.env[key] = value
    }
    envLoaded = true
  }

  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      ensureEnv(server.config.mode, server.config.envDir || server.config.root)

      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url || '/'
          if (!rawUrl.startsWith('/api/')) {
            next()
            return
          }

          const host = req.headers.host || 'localhost'
          const url = new URL(rawUrl, `http://${host}`)
          if (path.basename(url.pathname).startsWith('_')) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'Not found' }))
            return
          }

          const file = resolveApiFile(apiRoot, url.pathname)
          if (!file) {
            res.statusCode = 404
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: `No API route for ${url.pathname}` }))
            return
          }

          const mod = (await import(
            `${pathToFileURL(file).href}?t=${Date.now()}`
          )) as ApiModule
          const method = (req.method || 'GET').toUpperCase()
          const handler =
            mod[method as keyof ApiModule] ||
            (typeof mod.default === 'function' ? mod.default : undefined)

          if (typeof handler !== 'function') {
            res.statusCode = 405
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: `Method ${method} not allowed` }))
            return
          }

          const body = await readBody(req)
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (value == null) continue
            if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
            else headers.set(key, value)
          }

          const request = new Request(url, {
            method,
            headers,
            body: body && body.length > 0 ? body : undefined,
            // @ts-expect-error Node undici duplex requirement for request bodies
            duplex: body && body.length > 0 ? 'half' : undefined,
          })

          const response = await handler(request)
          await writeResponse(res, response)
        } catch (error) {
          console.error('[vercel-api-dev]', error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                error:
                  error instanceof Error ? error.message : 'API handler failed',
              }),
            )
          }
        }
      })
    },
  }
}
