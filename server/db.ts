import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error', error))

export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await work(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
