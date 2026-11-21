import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pool from './pool.js'

const migrationsDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url))
const migrationLockName = 'gridironpulse:schema_migrations'

export async function runMigrations() {
  const client = await pool.connect()
  let lockAcquired = false

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [migrationLockName])
    lockAcquired = true
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    )

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort()

    for (const filename of filenames) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename],
      )
      if (rowCount) continue

      const migration = await readFile(path.join(migrationsDirectory, filename), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(migration)
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [filename],
        )
        await client.query('COMMIT')
        console.log(`Applied database migration ${filename}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Failed to apply database migration ${filename}.`, { cause: error })
      }
    }
  } finally {
    try {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [migrationLockName])
      }
    } finally {
      client.release()
    }
  }
}
