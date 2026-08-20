import { pool } from '../db.js'
import { processPendingAiReviews } from '../aiReview.js'

async function run() {
  const limit = Math.max(1, Math.min(25, Number(process.env.AI_REVIEW_BATCH_SIZE ?? 5)))
  const processed = await processPendingAiReviews(limit)
  console.log(`Processed ${processed} AI assessment review${processed === 1 ? '' : 's'}`)
}

run()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => pool.end())
