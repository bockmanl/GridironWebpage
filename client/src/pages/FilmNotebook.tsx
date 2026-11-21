import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../api'
import './pages.css'

interface PlayTimestamp {
  time: string
  observation: string
  correction: string
}

interface FilmNote {
  id: string
  opponent: string
  session_date: string
  session_type: 'Game' | 'Practice'
  general_notes: string
  timestamps: PlayTimestamp[]
  created_at: string
}

interface FilmForm {
  opponent: string
  session_date: string
  session_type: 'Game' | 'Practice'
  general_notes: string
  timestamps: PlayTimestamp[]
}

function todayAsInputValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function emptyForm(): FilmForm {
  return {
    opponent: '',
    session_date: todayAsInputValue(),
    session_type: 'Game',
    general_notes: '',
    timestamps: [{ time: '', observation: '', correction: '' }],
  }
}

function displayDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function FilmNotebook() {
  const [notes, setNotes] = useState<FilmNote[]>([])
  const [form, setForm] = useState<FilmForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [opponentFilter, setOpponentFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams()
      if (opponentFilter.trim()) params.set('opponent', opponentFilter.trim())
      if (searchFilter.trim()) params.set('search', searchFilter.trim())
      setLoading(true)
      try {
        const result = await apiRequest<FilmNote[]>(`/api/film-notes?${params.toString()}`)
        if (!cancelled) {
          setNotes(result)
          setError('')
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load film notes.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [opponentFilter, searchFilter, reloadToken])

  function updatePlay(index: number, field: keyof PlayTimestamp, value: string) {
    setForm((current) => ({
      ...current,
      timestamps: current.timestamps.map((play, playIndex) =>
        playIndex === index ? { ...play, [field]: value } : play,
      ),
    }))
  }

  function addPlay() {
    setForm((current) => ({
      ...current,
      timestamps: [...current.timestamps, { time: '', observation: '', correction: '' }],
    }))
  }

  function removePlay(index: number) {
    setForm((current) => ({
      ...current,
      timestamps: current.timestamps.filter((_, playIndex) => playIndex !== index),
    }))
  }

  function editNote(note: FilmNote) {
    setEditingId(note.id)
    setForm({
      opponent: note.opponent,
      session_date: note.session_date.slice(0, 10),
      session_type: note.session_type,
      general_notes: note.general_notes,
      timestamps: note.timestamps,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const endpoint = editingId ? `/api/film-notes/${editingId}` : '/api/film-notes'
      await apiRequest(endpoint, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          opponent: form.opponent.trim(),
          general_notes: form.general_notes.trim(),
        }),
      })
      setMessage(editingId ? 'Film note updated.' : 'Film note saved.')
      setForm(emptyForm())
      setEditingId(null)
      setReloadToken((current) => current + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save film note.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteNote(note: FilmNote) {
    if (!window.confirm(`Delete the film note for ${note.opponent}?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(`/api/film-notes/${note.id}`, { method: 'DELETE' })
      if (editingId === note.id) cancelEdit()
      setMessage('Film note deleted.')
      setReloadToken((current) => current + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete film note.')
    } finally {
      setBusy(false)
    }
  }

  const filtersActive = Boolean(opponentFilter || searchFilter)

  return (
    <div className="page-stack">
      <section className="page-hero">
        <p className="eyebrow">FILM STUDY / PLAY BREAKDOWN</p>
        <h1>See the game a little clearer.</h1>
        <p>Capture opponent tendencies, tag key moments, and turn every rep into a better next play.</p>
      </section>

      <section className="filter-bar" aria-label="Search film notes">
        <label className="filter-field">
          Search notes
          <input
            type="search"
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Search opponents or notes"
          />
        </label>
        <label className="filter-field">
          Opponent
          <input
            type="search"
            value={opponentFilter}
            onChange={(event) => setOpponentFilter(event.target.value)}
            placeholder="Filter by opponent"
          />
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={!filtersActive}
          onClick={() => {
            setOpponentFilter('')
            setSearchFilter('')
          }}
        >
          Clear filters
        </button>
      </section>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {message && <p className="notice success-notice" role="status">{message}</p>}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{editingId ? 'UPDATE YOUR NOTES' : 'ADD TO YOUR NOTEBOOK'}</p>
            <h2>{editingId ? 'Edit Film Note' : 'New Film Note'}</h2>
          </div>
          <span className="panel-icon" aria-hidden="true">✦</span>
        </div>
        <form className="form-stack" onSubmit={saveNote}>
          <label className="field">
            <span>Opponent Name</span>
            <input
              type="text"
              value={form.opponent}
              onChange={(event) => setForm({ ...form, opponent: event.target.value })}
              placeholder="e.g. North Hawks"
              required
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Session Date</span>
              <input
                type="date"
                value={form.session_date}
                onChange={(event) => setForm({ ...form, session_date: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Session Type</span>
              <select
                value={form.session_type}
                onChange={(event) =>
                  setForm({ ...form, session_type: event.target.value as FilmForm['session_type'] })
                }
              >
                <option>Game</option>
                <option>Practice</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>General Notes</span>
            <textarea
              rows={3}
              value={form.general_notes}
              onChange={(event) => setForm({ ...form, general_notes: event.target.value })}
              placeholder="What stood out in this session?"
            />
          </label>
          <div className="panel-heading play-heading">
            <div>
              <p className="eyebrow">BREAK IT DOWN</p>
              <h2>Timestamped Plays</h2>
            </div>
            <span className="count-badge">{form.timestamps.length} plays</span>
          </div>
          <div className="play-list">
            {form.timestamps.map((play, index) => (
              <div className="play-row" key={`play-${index}`}>
                <label className="field">
                  <span>Time</span>
                  <input
                    type="text"
                    value={play.time}
                    onChange={(event) => updatePlay(index, 'time', event.target.value)}
                    placeholder="00:32"
                  />
                </label>
                <label className="field">
                  <span>Observation</span>
                  <textarea
                    rows={2}
                    value={play.observation}
                    onChange={(event) => updatePlay(index, 'observation', event.target.value)}
                    placeholder="What happened?"
                  />
                </label>
                <label className="field">
                  <span>Coaching Correction</span>
                  <textarea
                    rows={2}
                    value={play.correction}
                    onChange={(event) => updatePlay(index, 'correction', event.target.value)}
                    placeholder="What to improve?"
                  />
                </label>
                <button
                  className="play-remove"
                  type="button"
                  aria-label={`Remove play ${index + 1}`}
                  onClick={() => removePlay(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={addPlay}>
              + Add Play Timestamp
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              {editingId ? 'Update Film Note' : 'Save Film Note'}
            </button>
            {editingId && (
              <button className="secondary-button" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SCOUTING HISTORY</p>
            <h2>Saved Film Notes</h2>
          </div>
          <span className="count-badge">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        </div>
        {loading ? (
          <p className="empty-state">Loading your film notebook...</p>
        ) : notes.length === 0 ? (
          <p className="empty-state">
            No film notes found. Save a session or adjust your filters to see notes here.
          </p>
        ) : (
          <div className="note-feed">
            {notes.map((note) => (
              <article className="note-card" key={note.id}>
                <div className="note-card-top">
                  <div>
                    <span className="entry-kicker">{note.session_type.toUpperCase()}</span>
                    <h3>{note.opponent}</h3>
                    <time dateTime={note.session_date}>{displayDate(note.session_date)}</time>
                  </div>
                  <span className="note-badge">{note.timestamps.length} plays</span>
                </div>
                {note.general_notes && <p className="note-card-copy">{note.general_notes}</p>}
                {note.timestamps.length > 0 && (
                  <div className="play-display-list">
                    {note.timestamps.map((play, index) => (
                      <div className="play-display" key={`${note.id}-play-${index}`}>
                        <time>{play.time || '—'}</time>
                        <div>
                          <p>{play.observation || 'No observation recorded.'}</p>
                          {play.correction && <small>Correction: {play.correction}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="note-actions">
                  <button className="text-button" type="button" onClick={() => editNote(note)}>
                    Edit
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteNote(note)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default FilmNotebook
