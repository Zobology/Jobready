# Zobology

Zobology — Assess. Improve. Get Hired.

A full-stack job-readiness portal for candidates, industry mentors, and administrators. The production architecture runs as a Node/Express web service on Render with Render PostgreSQL.

## Included

- Candidate and mentor name, email, and password registration
- Bcrypt password hashing and opaque HTTP-only database sessions
- Candidate profile, generated assessment, written/audio/Excel responses, and 24-hour review status
- AI-first criterion scoring with audio transcription, workbook evidence extraction, confidence flags, and durable retries
- Mentor validation of AI drafts with criterion-level correction capture and adaptive calibration history
- Admin-controlled AI-only eligibility gates based on review count, mean score difference, and exact agreement
- Mentor expertise registration, admin approval, workload-aware role/industry matching, and rubric scoring
- One mentor validation by default, with admin adjudication when two mentors exceptionally complete the same review
- Private S3-compatible storage authorization for assessment audio and resumes
- PostgreSQL migrations, immutable audit events, notification outbox, and Resend email job
- One Render Blueprint for the web service, database, and notification cron job
- 8 core competencies, 90 roles, 60 industries, and a tagged 7,118-item question bank

## Local frontend preview

Without `VITE_BACKEND_MODE=render`, the portal uses its isolated browser-only demonstration adapter:

```bash
npm install
npm run dev
```

## Full-stack development

Start PostgreSQL and configure `.env` from [`.env.example`](.env.example), then run:

```bash
npm run build
npm run migrate
npm run create-admin
npm start
```

Build the frontend with `VITE_BACKEND_MODE=render` when testing the real API. The combined server listens on `PORT`, exposes `/api/health`, serves `/api/*`, and serves the compiled React application for all other routes.

## Render deployment

The [`render.yaml`](render.yaml) Blueprint creates:

- `zobology`: Node web service
- `zobology-db`: managed PostgreSQL
- `zobology-notifications`: five-minute transactional-email cron job

In Render, create a Blueprint from this repository and supply the prompted secrets:

- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

The pre-deploy command applies tracked migrations from [`server/migrations`](server/migrations). The first-deploy hook creates the initial administrator. Do not manually edit production tables; add a new numbered migration instead.

Render services use an ephemeral filesystem, so audio, resumes, and candidate workbooks must use private S3-compatible object storage such as Cloudflare R2 or AWS S3. PostgreSQL stores only controlled object keys and metadata.

During calibration, AI drafts every criterion score but results cannot publish until a mentor explicitly validates every question. Mentor changes become calibration records used in later AI prompts. The admin can enable AI-only publication only after the configured calibration gate is met; low-confidence or incomplete evidence still routes to mentors.

## Commands

```bash
npm run lint
npm run build
npm run migrate
npm run create-admin
npm run notifications
npm run ai-reviews
npm start
```

The question-bank model is documented in [`docs/question-bank.md`](docs/question-bank.md).
