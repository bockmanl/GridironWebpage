CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT users_full_name_not_blank CHECK (length(trim(full_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS readiness_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sleep_hours NUMERIC(4, 2) CHECK (sleep_hours BETWEEN 0 AND 24),
    sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
    soreness_level SMALLINT CHECK (soreness_level BETWEEN 0 AND 10),
    fatigue_level SMALLINT CHECK (fatigue_level BETWEEN 0 AND 10),
    readiness_score SMALLINT CHECK (readiness_score BETWEEN 1 AND 10),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS readiness_logs_user_logged_at_idx
    ON readiness_logs (user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workout_type TEXT NOT NULL
        CHECK (workout_type IN ('lifting', 'conditioning', 'mobility', 'practice', 'recovery', 'other')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    intensity SMALLINT CHECK (intensity BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workouts_user_started_at_idx
    ON workouts (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS film_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    opponent_name TEXT NOT NULL CHECK (length(trim(opponent_name)) > 0),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    game_date DATE,
    side TEXT NOT NULL
        CHECK (side IN ('offense', 'defense', 'special_teams')),
    play_type TEXT,
    period SMALLINT CHECK (period BETWEEN 1 AND 5),
    video_timestamp_seconds INTEGER CHECK (video_timestamp_seconds >= 0),
    video_url TEXT,
    notes TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS film_notes_user_opponent_created_at_idx
    ON film_notes (user_id, opponent_name, created_at DESC);
