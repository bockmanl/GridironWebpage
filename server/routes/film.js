import { Router } from 'express'

const demoUserId = '00000000-0000-0000-0000-000000000001'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sessionTypes = new Set(['Game', 'Practice'])

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateFilmNote(body) {
  if (!isObject(body)) {
    return 'Request body must be a JSON object.'
  }
  if (typeof body.opponent !== 'string' || body.opponent.trim().length === 0) {
    return 'opponent must be a non-empty string.'
  }
  if (typeof body.session_date !== 'string' || !isValidDate(body.session_date)) {
    return 'session_date must be a valid YYYY-MM-DD date.'
  }
  if (!sessionTypes.has(body.session_type)) {
    return 'session_type must be Game or Practice.'
  }
  if (typeof body.general_notes !== 'string') {
    return 'general_notes must be a string.'
  }
  if (!Array.isArray(body.timestamps) || !body.timestamps.every(isValidTimestamp)) {
    return 'timestamps must be an array of { time, observation, correction } objects.'
  }
  return null
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function isValidTimestamp(value) {
  return (
    isObject(value) &&
    typeof value.time === 'string' &&
    value.time.trim().length > 0 &&
    typeof value.observation === 'string' &&
    typeof value.correction === 'string'
  )
}

function getFilmNoteValues(body) {
  return [
    demoUserId,
    body.opponent.trim(),
    body.session_date,
    body.session_type,
    body.general_notes,
    JSON.stringify(body.timestamps),
  ]
}

function selectFilmNote() {
  return `id, user_id, opponent, session_date, session_type,
          general_notes, timestamps, created_at`
}

export default function createFilmRouter(pool) {
  const router = Router()

  router.post('/', async (request, response, next) => {
    const validationError = validateFilmNote(request.body)
    if (validationError) {
      return response.status(400).json({ error: validationError })
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO film_notes
          (user_id, opponent, session_date, session_type, general_notes, timestamps,
           opponent_name, title, game_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $2, $2 || ' - ' || $4, $3, $5)
         RETURNING ${selectFilmNote()}`,
        getFilmNoteValues(request.body),
      )
      return response.status(201).json(rows[0])
    } catch (error) {
      return next(error)
    }
  })

  router.get('/', async (request, response, next) => {
    const { opponent, search } = request.query
    if (
      (opponent !== undefined && typeof opponent !== 'string') ||
      (search !== undefined && typeof search !== 'string')
    ) {
      return response.status(400).json({ error: 'opponent and search must be strings.' })
    }

    const values = [demoUserId]
    const filters = ['user_id = $1']
    if (opponent?.trim()) {
      values.push(`%${opponent.trim()}%`)
      filters.push(`opponent ILIKE $${values.length}`)
    }
    if (search?.trim()) {
      values.push(`%${search.trim()}%`)
      filters.push(`(opponent ILIKE $${values.length} OR general_notes ILIKE $${values.length})`)
    }

    try {
      const { rows } = await pool.query(
        `SELECT ${selectFilmNote()}
         FROM film_notes
         WHERE ${filters.join(' AND ')}
         ORDER BY session_date DESC, created_at DESC, id DESC`,
        values,
      )
      return response.json(rows)
    } catch (error) {
      return next(error)
    }
  })

  router.put('/:id', async (request, response, next) => {
    if (!uuidPattern.test(request.params.id)) {
      return response.status(400).json({ error: 'id must be a UUID.' })
    }
    const validationError = validateFilmNote(request.body)
    if (validationError) {
      return response.status(400).json({ error: validationError })
    }

    try {
      const values = getFilmNoteValues(request.body)
      const { rows } = await pool.query(
        `UPDATE film_notes
         SET opponent = $2, session_date = $3, session_type = $4, general_notes = $5,
             timestamps = $6::jsonb, opponent_name = $2, title = $2 || ' - ' || $4,
             game_date = $3, notes = $5
         WHERE user_id = $1 AND id = $7
         RETURNING ${selectFilmNote()}`,
        [...values, request.params.id],
      )
      if (rows.length === 0) {
        return response.status(404).json({ error: 'Film note not found.' })
      }
      return response.json(rows[0])
    } catch (error) {
      return next(error)
    }
  })

  router.delete('/:id', async (request, response, next) => {
    if (!uuidPattern.test(request.params.id)) {
      return response.status(400).json({ error: 'id must be a UUID.' })
    }

    try {
      const result = await pool.query(
        'DELETE FROM film_notes WHERE user_id = $1 AND id = $2',
        [demoUserId, request.params.id],
      )
      if (result.rowCount === 0) {
        return response.status(404).json({ error: 'Film note not found.' })
      }
      return response.status(204).end()
    } catch (error) {
      return next(error)
    }
  })

  return router
}
