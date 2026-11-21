import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionTimeoutMillis: 5000 })

export default pool
