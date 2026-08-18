import bcrypt from 'bcryptjs'
import { pool } from './db.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD

if (!email || !password || password.length < 12) throw new Error('ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required')

async function createAdmin() {
  const passwordHash = await bcrypt.hash(password!, 12)
  await pool.query(
    `insert into users (email, password_hash, role) values ($1,$2,'admin')
     on conflict (email) do update set password_hash=excluded.password_hash, role='admin', updated_at=now()`,
    [email, passwordHash],
  )
  console.log(`Admin account ready: ${email}`)
  await pool.end()
}

createAdmin().catch((error) => { console.error(error); process.exitCode = 1 })
