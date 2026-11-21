BEGIN;

ALTER TABLE readiness_logs
    ADD COLUMN IF NOT EXISTS sore_muscles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE readiness_logs
    DROP CONSTRAINT IF EXISTS readiness_logs_sleep_quality_check,
    ADD CONSTRAINT readiness_logs_sleep_quality_check
        CHECK (sleep_quality BETWEEN 1 AND 10),
    DROP CONSTRAINT IF EXISTS readiness_logs_fatigue_level_check,
    ADD CONSTRAINT readiness_logs_fatigue_level_check
        CHECK (fatigue_level BETWEEN 1 AND 10);

ALTER TABLE film_notes
    ADD COLUMN IF NOT EXISTS opponent TEXT,
    ADD COLUMN IF NOT EXISTS session_date DATE,
    ADD COLUMN IF NOT EXISTS session_type TEXT,
    ADD COLUMN IF NOT EXISTS general_notes TEXT,
    ADD COLUMN IF NOT EXISTS timestamps JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE film_notes
SET opponent = COALESCE(opponent, opponent_name),
    session_date = COALESCE(session_date, game_date, CURRENT_DATE),
    session_type = COALESCE(session_type, 'Game'),
    general_notes = COALESCE(general_notes, notes);

ALTER TABLE film_notes
    ALTER COLUMN opponent SET NOT NULL,
    ALTER COLUMN session_date SET NOT NULL,
    ALTER COLUMN session_type SET NOT NULL,
    ALTER COLUMN general_notes SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'film_notes_session_type_check'
          AND conrelid = 'film_notes'::regclass
    ) THEN
        ALTER TABLE film_notes
            ADD CONSTRAINT film_notes_session_type_check
            CHECK (session_type IN ('Game', 'Practice'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'film_notes_timestamps_array_check'
          AND conrelid = 'film_notes'::regclass
    ) THEN
        ALTER TABLE film_notes
            ADD CONSTRAINT film_notes_timestamps_array_check
            CHECK (jsonb_typeof(timestamps) = 'array');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS film_notes_user_session_date_idx
    ON film_notes (user_id, session_date DESC);

INSERT INTO users (id, email, password_hash, full_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'local-demo@example.invalid',
    'local-development-only',
    'Local Demo Athlete'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
