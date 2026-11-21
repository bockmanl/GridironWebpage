import { Router } from 'express'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool()
const router = Router()
const userId = '00000000-0000-0000-0000-000000000001'

function validNote(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof body.opponent === 'string' &&
    body.opponent.trim().length > 0 &&
    typeof body.session_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.session_date) &&
    !Number.isNaN(Date.parse(`${body.session_date}T00:00:00Z`)) &&
    ['Game', 'Practice'].includes(body.session_type) &&
    typeof body.general_notes === 'string' &&
    Array.isArray(body.timestamps) &&
    body.timestamps.every(
      (play) =>
        play &&
        typeof play.time === 'string' &&
        typeof play.observation === 'string' &&
        typeof play.correction === 'string',
    )
  )
}

function noteValues(body) {
  const opponent = body.opponent.trim()
  const generalNotes = body.general_notes.trim()
  return [
    userId,
    opponent,
    `${body.session_type}: ${opponent}`,
    body.session_date,
    generalNotes,
    body.session_type,
    generalNotes,
    JSON.stringify(body.timestamps),
  ]
}

const noteColumns = `id, opponent, session_date, session_type, general_notes, timestamps, created_at`
const insertNote = `INSERT INTO film_notes
  (user_id, opponent_name, title, game_date, side, notes, opponent, session_date, session_type, general_notes, timestamps)
  VALUES ($1, $2, $3, $4, 'offense', $5, $2, $4, $6, $7, $8)`

router.post('/', async (request, response, next) => {
  if (!validNote(request.body)) {
    return response.status(400).json({ error: 'Film note fields are invalid.' })
  }
  try {
    const values = noteValues(request.body)
    const { rows } = await pool.query(
      `${insertNote} RETURNING ${noteColumns}`,
      values,
    )
    return response.status(201).json(rows[0])
  } catch (error) {
    return next(error)
  }
})

router.get('/', async (request, response, next) => {
  const opponent = typeof request.query.opponent === 'string' ? request.query.opponent.trim() : ''
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : ''
  try {
    const { rows } = await pool.query(
      `SELECT ${noteColumns}
       FROM film_notes
       WHERE user_id = $1
         AND ($2 = '' OR opponent ILIKE '%' || $2 || '%')
         AND ($3 = '' OR opponent ILIKE '%' || $3 || '%' OR general_notes ILIKE '%' || $3 || '%')
       ORDER BY session_date DESC, created_at DESC`,
      [userId, opponent, search],
    )
    return response.json(rows)
  } catch (error) {
    return next(error)
  }
})

router.put('/:id', async (request, response, next) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'A valid film note ID is required.' })
  }
  if (!validNote(request.body)) {
    return response.status(400).json({ error: 'Film note fields are invalid.' })
  }
  try {
    const values = noteValues(request.body)
    const { rows } = await pool.query(
      `UPDATE film_notes
       SET opponent_name = $2, title = $3, game_date = $4, notes = $5,
           opponent = $2, session_date = $4, session_type = $6,
           general_notes = $7, timestamps = $8
       WHERE id = $9 AND user_id = $1
       RETURNING ${noteColumns}`,
      [...values, request.params.id],
    )
    if (!rows.length) return response.status(404).json({ error: 'Film note not found.' })
    return response.json(rows[0])
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', async (request, response, next) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'A valid film note ID is required.' })
  }
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM film_notes WHERE id = $1 AND user_id = $2',
      [request.params.id, userId],
    )
    if (!rowCount) return response.status(404).json({ error: 'Film note not found.' })
    return response.json({ deleted: true })
  } catch (error) {
    return next(error)
  }
})

export default router
