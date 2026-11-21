BEGIN;

ALTER TABLE film_notes
    ADD COLUMN IF NOT EXISTS opponent TEXT,
    ADD COLUMN IF NOT EXISTS session_date DATE,
    ADD COLUMN IF NOT EXISTS session_type TEXT,
    ADD COLUMN IF NOT EXISTS general_notes TEXT,
    ADD COLUMN IF NOT EXISTS timestamps JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE film_notes
SET opponent = COALESCE(opponent, opponent_name),
    session_date = COALESCE(session_date, game_date, created_at::date),
    session_type = COALESCE(session_type, 'Game'),
    general_notes = COALESCE(general_notes, notes);

ALTER TABLE film_notes
    ALTER COLUMN opponent SET NOT NULL,
    ALTER COLUMN session_date SET NOT NULL,
    ALTER COLUMN session_type SET NOT NULL,
    ALTER COLUMN general_notes SET NOT NULL,
    ALTER COLUMN side DROP NOT NULL;

ALTER TABLE film_notes
    DROP CONSTRAINT IF EXISTS film_notes_session_type_check,
    DROP CONSTRAINT IF EXISTS film_notes_timestamps_array_check,
    DROP CONSTRAINT IF EXISTS film_notes_opponent_not_blank;

ALTER TABLE film_notes
    ADD CONSTRAINT film_notes_session_type_check
        CHECK (session_type IN ('Game', 'Practice')),
    ADD CONSTRAINT film_notes_timestamps_array_check
        CHECK (jsonb_typeof(timestamps) = 'array'),
    ADD CONSTRAINT film_notes_opponent_not_blank
        CHECK (length(trim(opponent)) > 0);

INSERT INTO users (id, email, password_hash, full_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'local-demo@example.invalid',
    '!disabled!',
    'Local Demo User'
)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS film_notes_user_session_date_idx
    ON film_notes (user_id, session_date DESC);

COMMIT;
