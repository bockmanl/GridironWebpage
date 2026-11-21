import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../api'
import './pages.css'

const soreAreas = ['Hamstrings', 'Quads', 'Calves', 'Shoulders', 'Lower Back', 'Hip Flexors']
const workoutOptions = ['Lifting', 'Mobility/Rehab'] as const

type WorkoutType = (typeof workoutOptions)[number]

interface ReadinessLog {
  id: string
  logged_at: string
  sleep_quality: number
  fatigue_level: number
  sore_muscles: string[]
  notes: string
}

interface WorkoutLog {
  id: string
  started_at: string
  type: WorkoutType
  duration_mins: number
  intensity: number
  notes: string
}

interface LogsResponse {
  readiness_logs: ReadinessLog[]
  workouts: WorkoutLog[]
}

interface ReadinessForm {
  sleep_quality: number
  fatigue_level: number
  sore_muscles: string[]
  notes: string
}

interface WorkoutForm {
  type: WorkoutType
  duration_mins: number
  intensity: number
  notes: string
}

interface LogEdit extends ReadinessForm, WorkoutForm {
  id: string
  kind: 'readiness' | 'workout'
}

const emptyReadiness = (): ReadinessForm => ({
  sleep_quality: 7,
  fatigue_level: 5,
  sore_muscles: [],
  notes: '',
})

const emptyWorkout = (): WorkoutForm => ({
  type: 'Lifting',
  duration_mins: 45,
  intensity: 5,
  notes: '',
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function RecoveryTracker() {
  const [readiness, setReadiness] = useState<ReadinessLog[]>([])
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [readinessForm, setReadinessForm] = useState(emptyReadiness)
  const [workoutForm, setWorkoutForm] = useState(emptyWorkout)
  const [editing, setEditing] = useState<LogEdit | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadLogs() {
    try {
      const data = await apiRequest<LogsResponse>('/api/logs')
      setReadiness(data.readiness_logs)
      setWorkouts(data.workouts)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void apiRequest<LogsResponse>('/api/logs')
      .then((data) => {
        if (cancelled) return
        setReadiness(data.readiness_logs)
        setWorkouts(data.workouts)
        setError('')
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load logs.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function submitReadiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/readiness', {
        method: 'POST',
        body: JSON.stringify(readinessForm),
      })
      setReadinessForm(emptyReadiness())
      setMessage('Readiness check-in saved.')
      await loadLogs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save check-in.')
    } finally {
      setBusy(false)
    }
  }

  async function submitWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/workouts', {
        method: 'POST',
        body: JSON.stringify(workoutForm),
      })
      setWorkoutForm(emptyWorkout())
      setMessage('Workout saved.')
      await loadLogs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save workout.')
    } finally {
      setBusy(false)
    }
  }

  function editReadiness(log: ReadinessLog) {
    setEditing({
      kind: 'readiness',
      id: log.id,
      sleep_quality: log.sleep_quality,
      fatigue_level: log.fatigue_level,
      sore_muscles: log.sore_muscles,
      notes: log.notes ?? '',
      type: 'Lifting',
      duration_mins: 45,
      intensity: 5,
    })
  }

  function editWorkout(log: WorkoutLog) {
    setEditing({
      kind: 'workout',
      id: log.id,
      sleep_quality: 7,
      fatigue_level: 5,
      sore_muscles: [],
      notes: log.notes ?? '',
      type: log.type,
      duration_mins: log.duration_mins,
      intensity: log.intensity,
    })
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    setError('')
    setMessage('')
    const body =
      editing.kind === 'readiness'
        ? {
            sleep_quality: editing.sleep_quality,
            fatigue_level: editing.fatigue_level,
            sore_muscles: editing.sore_muscles,
            notes: editing.notes,
          }
        : {
            type: editing.type,
            duration_mins: editing.duration_mins,
            intensity: editing.intensity,
            notes: editing.notes,
          }
    try {
      await apiRequest(`/api/logs/${editing.kind}/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setEditing(null)
      setMessage('Log updated.')
      await loadLogs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update log.')
    } finally {
      setBusy(false)
    }
  }

  const entries = [
    ...readiness.map((item) => ({ kind: 'readiness' as const, item, date: item.logged_at })),
    ...workouts.map((item) => ({ kind: 'workout' as const, item, date: item.started_at })),
  ].sort((first, second) => Date.parse(second.date) - Date.parse(first.date))

  return (
    <div className="page-stack">
      <section className="page-hero recovery-hero">
        <p className="eyebrow">RECOVER SMARTER / TRAIN STRONGER</p>
        <h1>Recovery &amp; Workouts</h1>
        <p>Check in with your body and keep your training history in one place.</p>
      </section>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {message && <p className="notice success-notice" role="status">{message}</p>}

      <div className="form-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DAILY CHECK-IN</p>
              <h2>Readiness &amp; soreness</h2>
            </div>
            <span className="panel-icon" aria-hidden="true">01</span>
          </div>
          <form className="form-stack" onSubmit={submitReadiness}>
            <div className="field-grid">
              <label className="field">
                <span>Sleep Quality <small>(1-10)</small></span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={readinessForm.sleep_quality}
                  onChange={(event) =>
                    setReadinessForm({ ...readinessForm, sleep_quality: Number(event.target.value) })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Fatigue Level <small>(1-10)</small></span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={readinessForm.fatigue_level}
                  onChange={(event) =>
                    setReadinessForm({ ...readinessForm, fatigue_level: Number(event.target.value) })
                  }
                  required
                />
              </label>
            </div>
            <fieldset className="checkbox-fieldset">
              <legend>Sore muscles</legend>
              <div className="checkbox-grid">
                {soreAreas.map((area) => (
                  <label className="checkbox-label" key={area}>
                    <input
                      type="checkbox"
                      checked={readinessForm.sore_muscles.includes(area)}
                      onChange={(event) =>
                        setReadinessForm((current) => ({
                          ...current,
                          sore_muscles: event.target.checked
                            ? [...current.sore_muscles, area]
                            : current.sore_muscles.filter((muscle) => muscle !== area),
                        }))
                      }
                    />
                    {area}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={3}
                value={readinessForm.notes}
                onChange={(event) =>
                  setReadinessForm({ ...readinessForm, notes: event.target.value })
                }
                placeholder="How are you feeling today?"
              />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              Save readiness check-in
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TRAINING SESSION</p>
              <h2>Workout &amp; mobility</h2>
            </div>
            <span className="panel-icon" aria-hidden="true">02</span>
          </div>
          <form className="form-stack" onSubmit={submitWorkout}>
            <label className="field">
              <span>Workout Type</span>
              <select
                value={workoutForm.type}
                onChange={(event) =>
                  setWorkoutForm({ ...workoutForm, type: event.target.value as WorkoutType })
                }
              >
                {workoutOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <div className="field-grid">
              <label className="field">
                <span>Duration <small>(minutes)</small></span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={workoutForm.duration_mins}
                  onChange={(event) =>
                    setWorkoutForm({ ...workoutForm, duration_mins: Number(event.target.value) })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Intensity <small>(1-10)</small></span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={workoutForm.intensity}
                  onChange={(event) =>
                    setWorkoutForm({ ...workoutForm, intensity: Number(event.target.value) })
                  }
                  required
                />
              </label>
            </div>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={3}
                value={workoutForm.notes}
                onChange={(event) => setWorkoutForm({ ...workoutForm, notes: event.target.value })}
                placeholder="Exercises, focus, or recovery work..."
              />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              Save workout
            </button>
          </form>
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">YOUR ACTIVITY</p>
            <h2>Recent log history</h2>
          </div>
          <span className="count-badge">{entries.length} entries</span>
        </div>
        {loading ? (
          <p className="empty-state">Loading your logs...</p>
        ) : entries.length === 0 ? (
          <p className="empty-state">Your readiness and workout entries will show up here.</p>
        ) : (
          <div className="history-list">
            {entries.map((entry) => {
              const isEditing = editing?.id === entry.item.id
              return (
                <article className="history-entry" key={`${entry.kind}-${entry.item.id}`}>
                  <div className="history-entry-top">
                    <div>
                      <span className="entry-kicker">
                        {entry.kind === 'readiness' ? 'READINESS CHECK-IN' : 'WORKOUT'}
                      </span>
                      <h3>{entry.kind === 'readiness' ? 'Daily readiness' : entry.item.type}</h3>
                      <time>{formatDate(entry.date)}</time>
                    </div>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        entry.kind === 'readiness'
                          ? editReadiness(entry.item)
                          : editWorkout(entry.item)
                      }
                    >
                      {isEditing ? 'Editing' : 'Edit'}
                    </button>
                  </div>
                  {!isEditing && entry.kind === 'readiness' && (
                    <div className="entry-details">
                      <span>Sleep {entry.item.sleep_quality}/10</span>
                      <span>Fatigue {entry.item.fatigue_level}/10</span>
                      <span>{entry.item.sore_muscles.length ? entry.item.sore_muscles.join(', ') : 'No soreness selected'}</span>
                      {entry.item.notes && <p>{entry.item.notes}</p>}
                    </div>
                  )}
                  {!isEditing && entry.kind === 'workout' && (
                    <div className="entry-details">
                      <span>{entry.item.duration_mins} min</span>
                      <span>Intensity {entry.item.intensity}/10</span>
                      {entry.item.notes && <p>{entry.item.notes}</p>}
                    </div>
                  )}
                  {isEditing && editing && (
                    <form className="inline-edit form-stack" onSubmit={saveEdit}>
                      {editing.kind === 'readiness' ? (
                        <>
                          <div className="field-grid">
                            <label className="field">
                              <span>Sleep Quality</span>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={editing.sleep_quality}
                                onChange={(event) =>
                                  setEditing((current) =>
                                    current ? { ...current, sleep_quality: Number(event.target.value) } : current,
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Fatigue Level</span>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={editing.fatigue_level}
                                onChange={(event) =>
                                  setEditing((current) =>
                                    current ? { ...current, fatigue_level: Number(event.target.value) } : current,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <div className="checkbox-grid">
                            {soreAreas.map((area) => (
                              <label className="checkbox-label" key={area}>
                                <input
                                  type="checkbox"
                                  checked={editing.sore_muscles.includes(area)}
                                  onChange={(event) =>
                                    setEditing((current) =>
                                      current
                                        ? {
                                            ...current,
                                            sore_muscles: event.target.checked
                                              ? [...current.sore_muscles, area]
                                              : current.sore_muscles.filter((muscle) => muscle !== area),
                                          }
                                        : current,
                                    )
                                  }
                                />
                                {area}
                              </label>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="field-grid">
                            <label className="field">
                              <span>Workout Type</span>
                              <select
                                value={editing.type}
                                onChange={(event) =>
                                  setEditing((current) =>
                                    current ? { ...current, type: event.target.value as WorkoutType } : current,
                                  )
                                }
                              >
                                {workoutOptions.map((option) => <option key={option}>{option}</option>)}
                              </select>
                            </label>
                            <label className="field">
                              <span>Duration (minutes)</span>
                              <input
                                type="number"
                                min="1"
                                max="1440"
                                value={editing.duration_mins}
                                onChange={(event) =>
                                  setEditing((current) =>
                                    current ? { ...current, duration_mins: Number(event.target.value) } : current,
                                  )
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Intensity</span>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={editing.intensity}
                                onChange={(event) =>
                                  setEditing((current) =>
                                    current ? { ...current, intensity: Number(event.target.value) } : current,
                                  )
                                }
                              />
                            </label>
                          </div>
                        </>
                      )}
                      <label className="field">
                        <span>Notes</span>
                        <textarea
                          rows={2}
                          value={editing.notes}
                          onChange={(event) =>
                            setEditing((current) =>
                              current ? { ...current, notes: event.target.value } : current,
                            )
                          }
                        />
                      </label>
                      <div className="button-row">
                        <button className="primary-button compact-button" disabled={busy} type="submit">
                          Save changes
                        </button>
                        <button className="secondary-button" type="button" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default RecoveryTracker
