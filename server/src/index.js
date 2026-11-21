import express from 'express'
import pg from 'pg'
import createRecoveryRouter from '../routes/recovery.js'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT ?? 3000)
const pool = new Pool({ connectionTimeoutMillis: 5000 })

app.use(express.json())

app.use('/api', createRecoveryRouter(pool))

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? 400 : 500
  response.status(status).json({
    error: status === 400 ? 'Invalid request body.' : 'Internal server error',
  })
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
