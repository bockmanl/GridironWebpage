import { useEffect, useState } from 'react'
import './RecoveryTracker.css'

const MUSCLE_GROUPS = [
  'Hamstrings',
  'Quads',
  'Calves',
  'Shoulders',
  'Lower Back',
  'Hip Flexors',
]

const EMPTY_LOGS = {
  readiness_logs: [],
  workouts: [],
}

const EMPTY_READINESS = {
  sleep_quality: '',
  fatigue_level: '',
  sore_muscles: [],
  notes: '',
}

const EMPTY_WORKOUT = {
  type: 'lifting',
  duration_mins: '',
  intensity: '5',
  notes: '',
}

const TODAY = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date())

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || `Request failed with status ${response.status}.`)
  }

  return result
}

function sortEntries(entries, dateField) {
  return [...entries].sort(
    (first, second) =>
      new Date(second[dateField]).getTime() - new Date(first[dateField]).getTime(),
  )
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function ReadinessFields({ value, onChange, prefix }) {
  function toggleMuscle(muscle) {
    const soreMuscles = value.sore_muscles.includes(muscle)
      ? value.sore_muscles.filter((item) => item !== muscle)
      : [...value.sore_muscles, muscle]
    onChange({ ...value, sore_muscles: soreMuscles })
  }

  return (
    <>
      <div className="tracker-field-row">
        <label className="tracker-field" htmlFor={`${prefix}-sleep`}>
          <span className="tracker-field-label">Sleep Quality</span>
          <span className="tracker-input-suffix">
            <input
              id={`${prefix}-sleep`}
              type="number"
              min="1"
              max="10"
              step="1"
              required
              value={value.sleep_quality}
              onChange={(event) => onChange({ ...value, sleep_quality: event.target.value })}
              placeholder="1-10"
            />
            <span>/ 10</span>
          </span>
        </label>
        <label className="tracker-field" htmlFor={`${prefix}-fatigue`}>
          <span className="tracker-field-label">Fatigue Level</span>
          <span className="tracker-input-suffix">
            <input
              id={`${prefix}-fatigue`}
              type="number"
              min="1"
              max="10"
              step="1"
              required
              value={value.fatigue_level}
              onChange={(event) => onChange({ ...value, fatigue_level: event.target.value })}
              placeholder="1-10"
            />
            <span>/ 10</span>
          </span>
        </label>
      </div>

      <fieldset className="tracker-fieldset">
        <legend>Muscle soreness</legend>
        <div className="tracker-muscle-grid">
          {MUSCLE_GROUPS.map((muscle) => {
            const inputId = `${prefix}-${muscle.toLowerCase().replaceAll(' ', '-')}`
            return (
              <label className="tracker-muscle-option" htmlFor={inputId} key={muscle}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={value.sore_muscles.includes(muscle)}
                  onChange={() => toggleMuscle(muscle)}
                />
                <span>{muscle}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <label className="tracker-field" htmlFor={`${prefix}-notes`}>
        <span className="tracker-field-label">Notes</span>
        <textarea
          id={`${prefix}-notes`}
          rows="3"
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          placeholder="How are you feeling today?"
        />
      </label>
    </>
  )
}

function WorkoutFields({ value, onChange, prefix }) {
  return (
    <>
      <label className="tracker-field" htmlFor={`${prefix}-type`}>
        <span className="tracker-field-label">Workout Type</span>
        <select
          id={`${prefix}-type`}
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
        >
          <option value="lifting">Lifting</option>
          <option value="mobility">Mobility/Rehab</option>
        </select>
      </label>

      <div className="tracker-field-row">
        <label className="tracker-field" htmlFor={`${prefix}-duration`}>
          <span className="tracker-field-label">Duration</span>
          <span className="tracker-input-suffix">
            <input
              id={`${prefix}-duration`}
              type="number"
              min="1"
              step="1"
              required
              value={value.duration_mins}
              onChange={(event) => onChange({ ...value, duration_mins: event.target.value })}
              placeholder="45"
            />
            <span>min</span>
          </span>
        </label>
        <label className="tracker-field" htmlFor={`${prefix}-intensity`}>
          <span className="tracker-field-label">Intensity</span>
          <span className="tracker-input-suffix">
            <input
              id={`${prefix}-intensity`}
              type="number"
              min="1"
              max="10"
              step="1"
              required
              value={value.intensity}
              onChange={(event) => onChange({ ...value, intensity: event.target.value })}
              placeholder="1-10"
            />
            <span>/ 10</span>
          </span>
        </label>
      </div>

      <label className="tracker-field" htmlFor={`${prefix}-notes`}>
        <span className="tracker-field-label">Notes</span>
        <textarea
          id={`${prefix}-notes`}
          rows="3"
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          placeholder="Add a note about this session"
        />
      </label>
    </>
  )
}

function RecoveryTracker() {
  const [logs, setLogs] = useState(EMPTY_LOGS)
  const [readinessForm, setReadinessForm] = useState(EMPTY_READINESS)
  const [workoutForm, setWorkoutForm] = useState(EMPTY_WORKOUT)
  const [editing, setEditing] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingForm, setPendingForm] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/logs', { signal: controller.signal })
      .then((result) => {
        if (!Array.isArray(result.readiness_logs) || !Array.isArray(result.workouts)) {
          throw new Error('The server returned an unexpected log history response.')
        }
        setLogs(result)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message)
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [])

  const recentLogs = [
    ...logs.readiness_logs.map((entry) => ({
      ...entry,
      logType: 'readiness',
      date: entry.logged_at,
    })),
    ...logs.workouts.map((entry) => ({
      ...entry,
      logType: 'workout',
      date: entry.started_at,
    })),
  ].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())

  async function submitReadiness(event) {
    event.preventDefault()
    setPendingForm('readiness')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const entry = await apiRequest('/readiness', {
        method: 'POST',
        body: JSON.stringify({
          sleep_quality: Number(readinessForm.sleep_quality),
          fatigue_level: Number(readinessForm.fatigue_level),
          sore_muscles: readinessForm.sore_muscles,
          notes: readinessForm.notes,
        }),
      })
      setLogs((current) => ({
        ...current,
        readiness_logs: sortEntries([entry, ...current.readiness_logs], 'logged_at'),
      }))
      setReadinessForm(EMPTY_READINESS)
      setSuccessMessage('Readiness check-in saved.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setPendingForm('')
    }
  }

  async function submitWorkout(event) {
    event.preventDefault()
    setPendingForm('workout')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const entry = await apiRequest('/workouts', {
        method: 'POST',
        body: JSON.stringify({
          type: workoutForm.type,
          duration_mins: Number(workoutForm.duration_mins),
          intensity: Number(workoutForm.intensity),
          notes: workoutForm.notes,
        }),
      })
      setLogs((current) => ({
        ...current,
        workouts: sortEntries([entry, ...current.workouts], 'started_at'),
      }))
      setWorkoutForm(EMPTY_WORKOUT)
      setSuccessMessage('Workout session saved.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setPendingForm('')
    }
  }

  function beginEdit(entry) {
    if (entry.logType === 'readiness') {
      setEditing({
        type: 'readiness',
        id: entry.id,
        sleep_quality: String(entry.sleep_quality ?? ''),
        fatigue_level: String(entry.fatigue_level ?? ''),
        sore_muscles: entry.sore_muscles ?? [],
        notes: entry.notes ?? '',
      })
      return
    }

    setEditing({
      type: 'workout',
      id: entry.id,
      typeValue: entry.workout_type,
      duration_mins: String(entry.duration_minutes),
      intensity: String(entry.intensity ?? ''),
      notes: entry.notes ?? '',
    })
  }

  async function saveEdit(event) {
    event.preventDefault()
    const logType = editing.type
    setPendingForm(`edit-${logType}`)
    setErrorMessage('')
    setSuccessMessage('')

    const body =
      logType === 'readiness'
        ? {
            sleep_quality: Number(editing.sleep_quality),
            fatigue_level: Number(editing.fatigue_level),
            sore_muscles: editing.sore_muscles,
            notes: editing.notes,
          }
        : {
            type: editing.typeValue,
            duration_mins: Number(editing.duration_mins),
            intensity: Number(editing.intensity),
            notes: editing.notes,
          }

    try {
      const updated = await apiRequest(`/logs/${logType}/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      const collection = logType === 'readiness' ? 'readiness_logs' : 'workouts'
      const dateField = logType === 'readiness' ? 'logged_at' : 'started_at'
      setLogs((current) => ({
        ...current,
        [collection]: sortEntries(
          current[collection].map((entry) => (entry.id === updated.id ? updated : entry)),
          dateField,
        ),
      }))
      setEditing(null)
      setSuccessMessage('Log updated.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setPendingForm('')
    }
  }

  function updateEditing(value) {
    setEditing((current) => ({ ...current, ...value }))
  }

  return (
    <main className="recovery-tracker">
      <div className="tracker-shell">
        <header className="tracker-header">
          <a className="tracker-brand" href="/" aria-label="Gridiron home">
            <span className="tracker-brand-mark">G</span>
            <span>
              <strong>GRIDIRON</strong>
              <small>ATHLETE TRACKER</small>
            </span>
          </a>
          <span className="tracker-header-tag">
            <span className="tracker-status-dot" />
            RECOVERY SPACE
          </span>
        </header>

        <section className="tracker-hero" aria-labelledby="tracker-title">
          <div className="tracker-hero-copy">
            <p className="tracker-hero-kicker">ATHLETE WELLNESS / DAILY CHECK-IN</p>
            <h1 id="tracker-title">Build readiness, one day at a time.</h1>
            <p className="tracker-hero-description">
              Track how you feel, log the work you put in, and keep your recovery moving forward.
            </p>
          </div>
          <div className="tracker-date-card">
            <span>TODAY</span>
            <strong>{TODAY}</strong>
            <span className="tracker-date-caption">A new day to get better</span>
          </div>
          <span className="tracker-hero-orbit tracker-hero-orbit-one" />
          <span className="tracker-hero-orbit tracker-hero-orbit-two" />
        </section>

        {errorMessage && (
          <div className="tracker-alert tracker-alert-error" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage('')} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {successMessage && (
          <div className="tracker-alert tracker-alert-success" role="status">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              aria-label="Dismiss success message"
            >
              ×
            </button>
          </div>
        )}

        <div className="tracker-form-grid">
          <section className="tracker-card" aria-labelledby="readiness-title">
            <div className="tracker-card-heading">
              <span className="tracker-card-icon tracker-icon-sun" aria-hidden="true">
                ✦
              </span>
              <div>
                <p className="tracker-eyebrow">HOW ARE YOU FEELING?</p>
                <h2 id="readiness-title">Daily Readiness Check-In</h2>
              </div>
            </div>
            <form onSubmit={submitReadiness}>
              <ReadinessFields
                value={readinessForm}
                onChange={setReadinessForm}
                prefix="readiness"
              />
              <button
                className="tracker-primary-button"
                type="submit"
                disabled={pendingForm !== ''}
              >
                {pendingForm === 'readiness' ? 'Saving check-in…' : 'Save readiness'}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>

          <section className="tracker-card" aria-labelledby="workout-title">
            <div className="tracker-card-heading">
              <span className="tracker-card-icon tracker-icon-bolt" aria-hidden="true">
                ↗
              </span>
              <div>
                <p className="tracker-eyebrow">LOG YOUR SESSION</p>
                <h2 id="workout-title">Workout &amp; Mobility Logger</h2>
              </div>
            </div>
            <form onSubmit={submitWorkout}>
              <WorkoutFields value={workoutForm} onChange={setWorkoutForm} prefix="workout" />
              <button
                className="tracker-primary-button"
                type="submit"
                disabled={pendingForm !== ''}
              >
                {pendingForm === 'workout' ? 'Saving session…' : 'Save workout'}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </div>

        <section className="tracker-card tracker-history" aria-labelledby="history-title">
          <div className="tracker-history-heading">
            <div className="tracker-card-heading">
              <span className="tracker-card-icon tracker-icon-history" aria-hidden="true">
                ≡
              </span>
              <div>
                <p className="tracker-eyebrow">YOUR PROGRESS</p>
                <h2 id="history-title">Recent Log History</h2>
              </div>
            </div>
            <span className="tracker-entry-count">
              {recentLogs.length} {recentLogs.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {isLoading ? (
            <p className="tracker-empty-state">Loading your recent logs…</p>
          ) : recentLogs.length === 0 ? (
            <div className="tracker-empty-state">
              <span className="tracker-empty-mark" aria-hidden="true">
                +
              </span>
              <strong>Your log starts here</strong>
              <span>Complete a check-in or log a workout to see it here.</span>
            </div>
          ) : (
            <div className="tracker-log-list">
              {recentLogs.map((entry) => {
                const isEditing = editing?.id === entry.id && editing.type === entry.logType
                return (
                  <article className="tracker-log-entry" key={`${entry.logType}-${entry.id}`}>
                    <span
                      className={`tracker-log-marker tracker-log-marker-${entry.logType}`}
                      aria-hidden="true"
                    >
                      {entry.logType === 'readiness' ? 'R' : 'W'}
                    </span>
                    <div className="tracker-log-body">
                      <div className="tracker-log-topline">
                        <div>
                          <span className="tracker-log-type">
                            {entry.logType === 'readiness' ? 'READINESS CHECK-IN' : 'WORKOUT SESSION'}
                          </span>
                          <h3>
                            {entry.logType === 'readiness'
                              ? 'Daily readiness'
                              : entry.workout_type === 'mobility'
                                ? 'Mobility/Rehab'
                                : entry.workout_type.charAt(0).toUpperCase() +
                                  entry.workout_type.slice(1)}
                          </h3>
                        </div>
                        <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                      </div>

                      {isEditing ? (
                        <form className="tracker-edit-form" onSubmit={saveEdit}>
                          {editing.type === 'readiness' ? (
                            <ReadinessFields
                              value={editing}
                              onChange={updateEditing}
                              prefix={`edit-readiness-${entry.id}`}
                            />
                          ) : (
                            <WorkoutFields
                              value={{
                                type: editing.typeValue,
                                duration_mins: editing.duration_mins,
                                intensity: editing.intensity,
                                notes: editing.notes,
                              }}
                              onChange={(value) =>
                                updateEditing({
                                  typeValue: value.type,
                                  duration_mins: value.duration_mins,
                                  intensity: value.intensity,
                                  notes: value.notes,
                                })
                              }
                              prefix={`edit-workout-${entry.id}`}
                            />
                          )}
                          <div className="tracker-edit-actions">
                            <button
                              className="tracker-text-button"
                              type="button"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </button>
                            <button
                              className="tracker-primary-button tracker-save-edit"
                              type="submit"
                              disabled={pendingForm !== ''}
                            >
                              {pendingForm === `edit-${editing.type}` ? 'Saving…' : 'Save changes'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {entry.logType === 'readiness' ? (
                            <div className="tracker-log-details">
                              <span>
                                Sleep <strong>{entry.sleep_quality}/10</strong>
                              </span>
                              <span>
                                Fatigue <strong>{entry.fatigue_level}/10</strong>
                              </span>
                              {entry.sore_muscles?.length > 0 && (
                                <span className="tracker-muscle-summary">
                                  Sore: {entry.sore_muscles.join(', ')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="tracker-log-details">
                              <span>
                                {entry.duration_minutes} min
                              </span>
                              <span>
                                Intensity <strong>{entry.intensity}/10</strong>
                              </span>
                            </div>
                          )}
                          {entry.notes && <p className="tracker-log-notes">{entry.notes}</p>}
                          <button
                            className="tracker-text-button tracker-edit-button"
                            type="button"
                            onClick={() => beginEdit(entry)}
                          >
                            Edit <span aria-hidden="true">↗</span>
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer className="tracker-footer">
          <span>GRIDIRON / RECOVERY TRACKER</span>
          <span>Small steps. Stronger seasons.</span>
        </footer>
      </div>
    </main>
  )
}

export default RecoveryTracker
