import { Router } from 'express'

const demoUserId = '00000000-0000-0000-0000-000000000001'
const validWorkoutTypes = new Set([
  'lifting',
  'conditioning',
  'mobility',
  'practice',
  'recovery',
  'other',
])
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateReadiness(body) {
  if (!isObject(body)) {
    return 'Request body must be a JSON object.'
  }
  if (!Number.isInteger(body.sleep_quality) || body.sleep_quality < 1 || body.sleep_quality > 10) {
    return 'sleep_quality must be an integer from 1 to 10.'
  }
  if (!Number.isInteger(body.fatigue_level) || body.fatigue_level < 1 || body.fatigue_level > 10) {
    return 'fatigue_level must be an integer from 1 to 10.'
  }
  if (
    !Array.isArray(body.sore_muscles) ||
    !body.sore_muscles.every((muscle) => typeof muscle === 'string')
  ) {
    return 'sore_muscles must be an array of strings.'
  }
  if (typeof body.notes !== 'string') {
    return 'notes must be a string.'
  }
  return null
}

function validateWorkout(body) {
  if (!isObject(body)) {
    return 'Request body must be a JSON object.'
  }
  if (typeof body.type !== 'string' || !validWorkoutTypes.has(body.type)) {
    return 'type must be a supported workout type.'
  }
  if (!Number.isInteger(body.duration_mins) || body.duration_mins < 1) {
    return 'duration_mins must be a positive integer.'
  }
  if (!Number.isInteger(body.intensity) || body.intensity < 1 || body.intensity > 10) {
    return 'intensity must be an integer from 1 to 10.'
  }
  if (typeof body.notes !== 'string') {
    return 'notes must be a string.'
  }
  return null
}

export default function createRecoveryRouter(pool) {
  const router = Router()

  router.post('/readiness', async (request, response, next) => {
    const validationError = validateReadiness(request.body)
    if (validationError) {
      return response.status(400).json({ error: validationError })
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO readiness_logs
          (user_id, sleep_quality, fatigue_level, sore_muscles, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          demoUserId,
          request.body.sleep_quality,
          request.body.fatigue_level,
          request.body.sore_muscles,
          request.body.notes,
        ],
      )
      return response.status(201).json(rows[0])
    } catch (error) {
      return next(error)
    }
  })

  router.post('/workouts', async (request, response, next) => {
    const validationError = validateWorkout(request.body)
    if (validationError) {
      return response.status(400).json({ error: validationError })
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO workouts
          (user_id, workout_type, duration_minutes, intensity, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          demoUserId,
          request.body.type,
          request.body.duration_mins,
          request.body.intensity,
          request.body.notes,
        ],
      )
      return response.status(201).json(rows[0])
    } catch (error) {
      return next(error)
    }
  })

  router.get('/logs', async (_request, response, next) => {
    try {
      const [readinessResult, workoutsResult] = await Promise.all([
        pool.query(
          'SELECT * FROM readiness_logs WHERE user_id = $1 ORDER BY logged_at DESC, id DESC',
          [demoUserId],
        ),
        pool.query(
          'SELECT * FROM workouts WHERE user_id = $1 ORDER BY started_at DESC, id DESC',
          [demoUserId],
        ),
      ])
      return response.json({
        readiness_logs: readinessResult.rows,
        workouts: workoutsResult.rows,
      })
    } catch (error) {
      return next(error)
    }
  })

  router.put('/logs/:type/:id', async (request, response, next) => {
    const { type, id } = request.params
    if (!uuidPattern.test(id)) {
      return response.status(400).json({ error: 'id must be a UUID.' })
    }

    const isReadiness = type === 'readiness' || type === 'readiness_logs'
    const isWorkout = type === 'workout' || type === 'workouts'
    if (!isReadiness && !isWorkout) {
      return response.status(400).json({ error: 'type must be readiness or workout.' })
    }

    const validationError = isReadiness
      ? validateReadiness(request.body)
      : validateWorkout(request.body)
    if (validationError) {
      return response.status(400).json({ error: validationError })
    }

    try {
      const result = isReadiness
        ? await pool.query(
            `UPDATE readiness_logs
             SET sleep_quality = $1, fatigue_level = $2, sore_muscles = $3, notes = $4
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [
              request.body.sleep_quality,
              request.body.fatigue_level,
              request.body.sore_muscles,
              request.body.notes,
              id,
              demoUserId,
            ],
          )
        : await pool.query(
            `UPDATE workouts
             SET workout_type = $1, duration_minutes = $2, intensity = $3, notes = $4
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [
              request.body.type,
              request.body.duration_mins,
              request.body.intensity,
              request.body.notes,
              id,
              demoUserId,
            ],
          )

      if (result.rowCount === 0) {
        return response.status(404).json({ error: 'Log entry not found.' })
      }
      return response.json(result.rows[0])
    } catch (error) {
      return next(error)
    }
  })

  return router
}
