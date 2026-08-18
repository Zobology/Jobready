import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool, transaction } from './db.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.resolve(currentDirectory, '../../server/migrations')

async function migrate() {
  await pool.query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())')
  const files = (await fs.readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort()
  const applied = new Set((await pool.query<{ filename: string }>('select filename from schema_migrations')).rows.map((row) => row.filename))
  for (const filename of files) {
    if (applied.has(filename)) continue
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
    await transaction(async (client) => {
      await client.query(sql)
      await client.query('insert into schema_migrations (filename) values ($1)', [filename])
    })
    console.log(`Applied migration ${filename}`)
  }
  await pool.end()
}

migrate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
