import express from 'express'
import pg from 'pg'
import createRecoveryRouter from '../routes/recovery.js'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT ?? 3000)
const pool = new Pool({ connectionTimeoutMillis: 5000 })

app.use(express.json())

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    next(error)
  }
})

app.use('/api', createRecoveryRouter(pool))

app.use((error, _request, response, _next) => {
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return response.status(400).json({ error: 'Invalid JSON request body.' })
  }
  console.error(error)
  return response.status(500).json({ error: 'Internal server error' })
})

async function startServer() {
  try {
    await pool.query('SELECT 1')
    console.log('Connected to PostgreSQL')
  } catch (error) {
    console.error('Failed to connect to PostgreSQL during startup:', error)
    await pool.end()
    process.exitCode = 1
    return
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on port ${port}`)
  })
}

startServer()
