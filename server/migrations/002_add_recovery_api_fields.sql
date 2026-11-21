ALTER TABLE readiness_logs
    ADD COLUMN IF NOT EXISTS sore_muscles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE readiness_logs
    DROP CONSTRAINT IF EXISTS readiness_logs_sleep_quality_check;

ALTER TABLE readiness_logs
    ADD CONSTRAINT readiness_logs_sleep_quality_check
    CHECK (sleep_quality BETWEEN 1 AND 10);

INSERT INTO users (id, email, password_hash, full_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'local-demo@example.invalid',
    '!disabled!',
    'Local Demo User'
)
ON CONFLICT DO NOTHING;
