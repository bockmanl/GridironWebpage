import express from 'express'
import pg from 'pg'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT ?? 3000)
const pool = new Pool()

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
  response.status(500).json({ error: 'Internal server error' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`)
})
