# Zobology

Zobology — From Interview Room to Boardroom.

A full-stack job-readiness portal for candidates, industry reviewers, and administrators. The production architecture runs as a Node/Express web service on Render with Render PostgreSQL.

## Included

- Candidate and reviewer email/password registration
- Bcrypt password hashing and opaque HTTP-only database sessions
- Candidate profile, generated assessment, written/audio responses, and 24-hour review status
- Reviewer expertise registration, admin approval, workload-aware role/industry matching, and rubric scoring
- Two independent reviews followed by admin adjudication and result publication
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
- `RESEND_API_KEY`

The pre-deploy command applies tracked migrations from [`server/migrations`](server/migrations). The first-deploy hook creates the initial administrator. Do not manually edit production tables; add a new numbered migration instead.

Render services use an ephemeral filesystem, so audio and resumes must use private S3-compatible object storage such as Cloudflare R2 or AWS S3. PostgreSQL stores only controlled object keys and metadata.

## Commands

```bash
npm run lint
npm run build
npm run migrate
npm run create-admin
npm run notifications
npm start
```

The question-bank model is documented in [`docs/question-bank.md`](docs/question-bank.md).
