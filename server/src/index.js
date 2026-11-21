import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import filmRouter from '../routes/film.js'
import recoveryRouter from '../routes/recovery.js'
import { runMigrations } from './db/migrate.js'
import pool from './db/pool.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)
const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public')

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    next(error)
  }
})

app.use('/api', recoveryRouter)
app.use('/api/film-notes', filmRouter)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(publicDirectory, { index: false }))
  app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(publicDirectory, 'index.html'))
  })
}

async function startServer() {
  try {
    await runMigrations()
    await pool.query('SELECT 1')
    console.log('Database schema is ready')
  } catch (error) {
    console.error('Failed to prepare PostgreSQL during startup:', error)
    await pool.end()
    process.exitCode = 1
    return
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on port ${port}`)
  })
}

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must be valid JSON.' })
  }
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return response.status(error.status).json({ error: 'Invalid request.' })
  }
  response.status(500).json({ error: 'Internal server error' })
})

startServer()
