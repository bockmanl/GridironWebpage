import { Router } from 'express'
import pool from '../src/db/pool.js'
const router = Router()
const userId = '00000000-0000-0000-0000-000000000001'
const allowedSoreMuscles = new Set([
  'Hamstrings',
  'Quads',
  'Calves',
  'Shoulders',
  'Lower Back',
  'Hip Flexors',
])
const workoutTypes = new Map([
  ['lifting', 'lifting'],
  ['mobility', 'mobility'],
  ['mobility/rehab', 'mobility'],
])

function normalizeWorkoutType(value) {
  return typeof value === 'string' ? workoutTypes.get(value.toLowerCase()) : undefined
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

function validateReadiness(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    isIntegerInRange(body.sleep_quality, 1, 10) &&
    isIntegerInRange(body.fatigue_level, 1, 10) &&
    Array.isArray(body.sore_muscles) &&
    body.sore_muscles.every((muscle) => allowedSoreMuscles.has(muscle)) &&
    typeof body.notes === 'string'
  )
}

function validateWorkout(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Boolean(normalizeWorkoutType(body.type)) &&
    isIntegerInRange(body.duration_mins, 1, 1440) &&
    isIntegerInRange(body.intensity, 1, 10) &&
    typeof body.notes === 'string'
  )
}

router.post('/readiness', async (request, response, next) => {
  if (!validateReadiness(request.body)) {
    return response.status(400).json({
      error: 'sleep_quality and fatigue_level must be 1-10, sore_muscles must contain known areas, and notes must be text.',
    })
  }

  try {
    const { sleep_quality, fatigue_level, sore_muscles, notes } = request.body
    const { rows } = await pool.query(
      `INSERT INTO readiness_logs
        (user_id, sleep_quality, fatigue_level, sore_muscles, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, logged_at, sleep_quality, fatigue_level, sore_muscles, notes`,
      [userId, sleep_quality, fatigue_level, sore_muscles, notes.trim()],
    )
    return response.status(201).json(rows[0])
  } catch (error) {
    return next(error)
  }
})

router.post('/workouts', async (request, response, next) => {
  if (!validateWorkout(request.body)) {
    return response.status(400).json({
      error: 'type must be Lifting or Mobility/Rehab, duration_mins must be positive, intensity must be 1-10, and notes must be text.',
    })
  }

  try {
    const { type, duration_mins, intensity, notes } = request.body
    const { rows } = await pool.query(
      `INSERT INTO workouts (user_id, workout_type, duration_minutes, intensity, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, started_at, workout_type, duration_minutes, intensity, notes`,
      [userId, normalizeWorkoutType(type), duration_mins, intensity, notes.trim()],
    )
    const workout = rows[0]
    return response.status(201).json({
      ...workout,
      type,
      duration_mins: workout.duration_minutes,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/logs', async (_request, response, next) => {
  try {
    const [readiness, workouts] = await Promise.all([
      pool.query(
        `SELECT id, logged_at, sleep_quality, fatigue_level, sore_muscles, notes
         FROM readiness_logs WHERE user_id = $1 ORDER BY logged_at DESC`,
        [userId],
      ),
      pool.query(
        `SELECT id, started_at, workout_type, duration_minutes, intensity, notes
         FROM workouts WHERE user_id = $1 ORDER BY started_at DESC`,
        [userId],
      ),
    ])
    return response.json({
      readiness_logs: readiness.rows,
      workouts: workouts.rows.map((workout) => ({
        ...workout,
        type: workout.workout_type === 'mobility' ? 'Mobility/Rehab' : 'Lifting',
        duration_mins: workout.duration_minutes,
      })),
    })
  } catch (error) {
    return next(error)
  }
})

router.put('/logs/:type/:id', async (request, response, next) => {
  const { type, id } = request.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return response.status(400).json({ error: 'A valid log ID is required.' })
  }

  try {
    if (type === 'readiness') {
      if (!validateReadiness(request.body)) {
        return response.status(400).json({ error: 'Readiness values are invalid.' })
      }
      const { sleep_quality, fatigue_level, sore_muscles, notes } = request.body
      const { rows } = await pool.query(
        `UPDATE readiness_logs
         SET sleep_quality = $1, fatigue_level = $2, sore_muscles = $3, notes = $4
         WHERE id = $5 AND user_id = $6
         RETURNING id, logged_at, sleep_quality, fatigue_level, sore_muscles, notes`,
        [sleep_quality, fatigue_level, sore_muscles, notes.trim(), id, userId],
      )
      if (!rows.length) return response.status(404).json({ error: 'Readiness log not found.' })
      return response.json(rows[0])
    }

    if (type === 'workout') {
      if (!validateWorkout(request.body)) {
        return response.status(400).json({ error: 'Workout values are invalid.' })
      }
      const { type: workoutType, duration_mins, intensity, notes } = request.body
      const { rows } = await pool.query(
        `UPDATE workouts
         SET workout_type = $1, duration_minutes = $2, intensity = $3, notes = $4
         WHERE id = $5 AND user_id = $6
         RETURNING id, started_at, workout_type, duration_minutes, intensity, notes`,
        [normalizeWorkoutType(workoutType), duration_mins, intensity, notes.trim(), id, userId],
      )
      if (!rows.length) return response.status(404).json({ error: 'Workout not found.' })
      const workout = rows[0]
      return response.json({
        ...workout,
        type: workoutType,
        duration_mins: workout.duration_minutes,
      })
    }

    return response.status(400).json({ error: 'type must be readiness or workout.' })
  } catch (error) {
    return next(error)
  }
})

export default router
