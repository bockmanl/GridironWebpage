import { useEffect, useState } from 'react'
import './FilmNotebook.css'

function todayAsInputValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function createPlay() {
  return {
    clientId: crypto.randomUUID(),
    time: '',
    observation: '',
    correction: '',
  }
}

function createEmptyNote() {
  return {
    opponent: '',
    session_date: todayAsInputValue(),
    session_type: 'Game',
    general_notes: '',
    timestamps: [createPlay()],
  }
}

const TODAY = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date())

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (response.status === 204) {
    return null
  }

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error || `Request failed with status ${response.status}.`)
  }
  return result
}

function sortNotes(notes) {
  return [...notes].sort((first, second) => {
    const dateDifference =
      new Date(second.session_date).getTime() - new Date(first.session_date).getTime()
    if (dateDifference !== 0) {
      return dateDifference
    }
    return new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
  })
}

function matchesFilters(note, opponentFilter, searchFilter) {
  const opponent = opponentFilter.trim().toLocaleLowerCase()
  const search = searchFilter.trim().toLocaleLowerCase()
  const noteOpponent = note.opponent.toLocaleLowerCase()
  const noteText = `${note.opponent} ${note.general_notes}`.toLocaleLowerCase()
  return (!opponent || noteOpponent.includes(opponent)) && (!search || noteText.includes(search))
}

function formatSessionDate(value) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function FilmNotebook() {
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(createEmptyNote)
  const [editingId, setEditingId] = useState('')
  const [opponentFilter, setOpponentFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setErrorMessage('')

      const params = new URLSearchParams()
      if (opponentFilter.trim()) {
        params.set('opponent', opponentFilter.trim())
      }
      if (searchFilter.trim()) {
        params.set('search', searchFilter.trim())
      }
      const query = params.size > 0 ? `?${params.toString()}` : ''

      try {
        const result = await apiRequest(`/api/film-notes${query}`, {
          signal: controller.signal,
        })
        if (!Array.isArray(result)) {
          throw new Error('The server returned an unexpected film-note response.')
        }
        setNotes(result)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [opponentFilter, searchFilter])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updatePlay(clientId, field, value) {
    setForm((current) => ({
      ...current,
      timestamps: current.timestamps.map((play) =>
        play.clientId === clientId ? { ...play, [field]: value } : play,
      ),
    }))
  }

  function addPlay() {
    setForm((current) => ({ ...current, timestamps: [...current.timestamps, createPlay()] }))
  }

  function removePlay(clientId) {
    setForm((current) => ({
      ...current,
      timestamps: current.timestamps.filter((play) => play.clientId !== clientId),
    }))
  }

  function clearForm() {
    setForm(createEmptyNote())
    setEditingId('')
  }

  function editNote(note) {
    setEditingId(note.id)
    setForm({
      opponent: note.opponent,
      session_date: note.session_date.slice(0, 10),
      session_type: note.session_type,
      general_notes: note.general_notes,
      timestamps: note.timestamps.map((play) => ({
        ...play,
        clientId: crypto.randomUUID(),
      })),
    })
    setErrorMessage('')
    setSuccessMessage('')
    document.getElementById('film-note-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  async function submitNote(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const timestamps = form.timestamps
      .filter((play) => play.time || play.observation || play.correction)
      .map(({ time, observation, correction }) => ({ time, observation, correction }))
    const hasIncompletePlay = timestamps.some(
      (play) => !play.time.trim() || !play.observation.trim() || !play.correction.trim(),
    )
    if (hasIncompletePlay) {
      setErrorMessage('Complete each timestamp row or remove it before saving.')
      return
    }

    setIsSaving(true)
    const payload = {
      opponent: form.opponent.trim(),
      session_date: form.session_date,
      session_type: form.session_type,
      general_notes: form.general_notes,
      timestamps,
    }

    try {
      const isEditing = Boolean(editingId)
      const savedNote = await apiRequest(
        isEditing ? `/api/film-notes/${editingId}` : '/api/film-notes',
        {
          method: isEditing ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )
      setNotes((current) => {
        const updated = isEditing
          ? current.map((note) => (note.id === savedNote.id ? savedNote : note))
          : [savedNote, ...current]
        return sortNotes(updated.filter((note) => matchesFilters(note, opponentFilter, searchFilter)))
      })
      clearForm()
      setSuccessMessage(isEditing ? 'Film note updated.' : 'Film note saved.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete the film note for ${note.opponent}?`)) {
      return
    }

    setDeletingId(note.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await apiRequest(`/api/film-notes/${note.id}`, { method: 'DELETE' })
      setNotes((current) => current.filter((entry) => entry.id !== note.id))
      if (editingId === note.id) {
        clearForm()
      }
      setSuccessMessage('Film note deleted.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <main className="film-notebook">
      <div className="film-shell">
        <header className="film-header">
          <a className="film-brand" href="/" aria-label="Gridiron home">
            <span className="film-brand-mark">G</span>
            <span>
              <strong>GRIDIRON</strong>
              <small>ATHLETE TRACKER</small>
            </span>
          </a>
          <span className="film-header-tag">
            <span className="film-status-dot" />
            FILM NOTEBOOK
          </span>
        </header>

        <section className="film-hero" aria-labelledby="film-title">
          <div className="film-hero-copy">
            <p className="film-hero-kicker">FILM STUDY / PLAY BREAKDOWN</p>
            <h1 id="film-title">See the game a little clearer.</h1>
            <p className="film-hero-description">
              Capture opponent tendencies, tag key moments, and turn every rep into a better next
              play.
            </p>
          </div>
          <div className="film-date-card">
            <span>TODAY</span>
            <strong>{TODAY}</strong>
            <span className="film-date-caption">Study the details</span>
          </div>
          <span className="film-hero-orbit film-hero-orbit-one" />
          <span className="film-hero-orbit film-hero-orbit-two" />
        </section>

        <section className="film-filter-card" aria-label="Search film notes">
          <label className="film-search-field" htmlFor="film-search">
            <span className="film-field-label">Search notes</span>
            <input
              id="film-search"
              type="search"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Search opponents or notes"
            />
          </label>
          <label className="film-search-field" htmlFor="film-opponent-filter">
            <span className="film-field-label">Opponent</span>
            <input
              id="film-opponent-filter"
              type="search"
              value={opponentFilter}
              onChange={(event) => setOpponentFilter(event.target.value)}
              placeholder="Filter by opponent"
            />
          </label>
          <button
            className="film-clear-filter"
            type="button"
            onClick={() => {
              setSearchFilter('')
              setOpponentFilter('')
            }}
            disabled={!searchFilter && !opponentFilter}
          >
            Clear filters
          </button>
        </section>

        {(errorMessage || successMessage) && (
          <div
            className={`film-alert ${errorMessage ? 'film-alert-error' : 'film-alert-success'}`}
            role={errorMessage ? 'alert' : 'status'}
          >
            <span>{errorMessage || successMessage}</span>
            <button
              type="button"
              onClick={() => {
                setErrorMessage('')
                setSuccessMessage('')
              }}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <div className="film-content-grid">
          <section className="film-card film-editor-card" aria-labelledby="film-form-title">
            <div className="film-card-heading">
              <span className="film-card-icon film-icon-editor" aria-hidden="true">
                ✦
              </span>
              <div>
                <p className="film-eyebrow">{editingId ? 'UPDATE YOUR BREAKDOWN' : 'ADD TO YOUR NOTEBOOK'}</p>
                <h2 id="film-form-title">{editingId ? 'Edit Film Note' : 'New Film Note'}</h2>
              </div>
            </div>

            <form id="film-note-form" onSubmit={submitNote}>
              <label className="film-field" htmlFor="film-opponent">
                <span className="film-field-label">Opponent Name</span>
                <input
                  id="film-opponent"
                  type="text"
                  value={form.opponent}
                  onChange={(event) => updateField('opponent', event.target.value)}
                  placeholder="e.g. North Hawks"
                  required
                />
              </label>

              <div className="film-field-row">
                <label className="film-field" htmlFor="film-session-date">
                  <span className="film-field-label">Session Date</span>
                  <input
                    id="film-session-date"
                    type="date"
                    value={form.session_date}
                    onChange={(event) => updateField('session_date', event.target.value)}
                    required
                  />
                </label>
                <label className="film-field" htmlFor="film-session-type">
                  <span className="film-field-label">Session Type</span>
                  <select
                    id="film-session-type"
                    value={form.session_type}
                    onChange={(event) => updateField('session_type', event.target.value)}
                  >
                    <option value="Game">Game</option>
                    <option value="Practice">Practice</option>
                  </select>
                </label>
              </div>

              <label className="film-field" htmlFor="film-general-notes">
                <span className="film-field-label">General Notes</span>
                <textarea
                  id="film-general-notes"
                  rows="3"
                  value={form.general_notes}
                  onChange={(event) => updateField('general_notes', event.target.value)}
                  placeholder="What stood out in this session?"
                />
              </label>

              <div className="film-timestamps-heading">
                <div>
                  <p className="film-eyebrow">BREAK IT DOWN</p>
                  <h3>Timestamped Plays</h3>
                </div>
                <span className="film-play-count">
                  {form.timestamps.length} {form.timestamps.length === 1 ? 'play' : 'plays'}
                </span>
              </div>

              <div className="film-play-list">
                {form.timestamps.map((play, index) => (
                  <fieldset className="film-play-row" key={play.clientId}>
                    <legend>Play {index + 1}</legend>
                    <div className="film-play-row-fields">
                      <label className="film-field" htmlFor={`play-time-${play.clientId}`}>
                        <span className="film-field-label">Time</span>
                        <input
                          id={`play-time-${play.clientId}`}
                          type="text"
                          value={play.time}
                          onChange={(event) => updatePlay(play.clientId, 'time', event.target.value)}
                          placeholder="00:32"
                        />
                      </label>
                      <label className="film-field" htmlFor={`play-observation-${play.clientId}`}>
                        <span className="film-field-label">Observation</span>
                        <input
                          id={`play-observation-${play.clientId}`}
                          type="text"
                          value={play.observation}
                          onChange={(event) =>
                            updatePlay(play.clientId, 'observation', event.target.value)
                          }
                          placeholder="What happened?"
                        />
                      </label>
                      <label className="film-field" htmlFor={`play-correction-${play.clientId}`}>
                        <span className="film-field-label">Coaching Correction</span>
                        <input
                          id={`play-correction-${play.clientId}`}
                          type="text"
                          value={play.correction}
                          onChange={(event) =>
                            updatePlay(play.clientId, 'correction', event.target.value)
                          }
                          placeholder="What to improve?"
                        />
                      </label>
                      <button
                        className="film-remove-play"
                        type="button"
                        onClick={() => removePlay(play.clientId)}
                        aria-label={`Remove play ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  </fieldset>
                ))}
              </div>

              <button className="film-add-play" type="button" onClick={addPlay}>
                <span aria-hidden="true">+</span> Add Play Timestamp
              </button>

              <div className="film-form-actions">
                {editingId && (
                  <button className="film-text-button" type="button" onClick={clearForm}>
                    Cancel edit
                  </button>
                )}
                <button className="film-primary-button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving…' : editingId ? 'Update Film Note' : 'Save Film Note'}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </section>

          <section className="film-card film-feed-card" aria-labelledby="film-feed-title">
            <div className="film-feed-heading">
              <div className="film-card-heading">
                <span className="film-card-icon film-icon-feed" aria-hidden="true">
                  ≡
                </span>
                <div>
                  <p className="film-eyebrow">SCOUTING HISTORY</p>
                  <h2 id="film-feed-title">Saved Film Notes</h2>
                </div>
              </div>
              <span className="film-note-count">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>

            {isLoading ? (
              <p className="film-empty-state">Loading your film notebook…</p>
            ) : notes.length === 0 ? (
              <div className="film-empty-state">
                <span className="film-empty-mark" aria-hidden="true">
                  +
                </span>
                <strong>No film notes found</strong>
                <span>Save a session or adjust your filters to see notes here.</span>
              </div>
            ) : (
              <div className="film-note-list">
                {notes.map((note) => (
                  <article className="film-note-entry" key={note.id}>
                    <div className="film-note-entry-heading">
                      <div>
                        <span className="film-note-type">{note.session_type.toUpperCase()}</span>
                        <h3>{note.opponent}</h3>
                        <time dateTime={note.session_date}>{formatSessionDate(note.session_date)}</time>
                      </div>
                      <span className="film-note-badge">{note.timestamps.length} plays</span>
                    </div>

                    {note.general_notes && (
                      <p className="film-general-notes">{note.general_notes}</p>
                    )}

                    {note.timestamps.length > 0 && (
                      <div className="film-note-plays">
                        {note.timestamps.map((play, index) => (
                          <div className="film-note-play" key={`${note.id}-${index}`}>
                            <span className="film-play-time">{play.time}</span>
                            <div className="film-play-copy">
                              <p>{play.observation}</p>
                              <span>{play.correction}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="film-note-actions">
                      <button
                        className="film-text-button"
                        type="button"
                        onClick={() => editNote(note)}
                      >
                        Edit <span aria-hidden="true">↗</span>
                      </button>
                      <button
                        className="film-delete-button"
                        type="button"
                        onClick={() => deleteNote(note)}
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="film-footer">
          <span>GRIDIRON / FILM NOTEBOOK</span>
          <span>Study the details. Own the next play.</span>
        </footer>
      </div>
    </main>
  )
}

export default FilmNotebook
