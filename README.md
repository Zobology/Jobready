# Zobology

Zobology — From Interview Room to Boardroom.

A role-based job-readiness portal for candidates, industry reviewers, and administrators.

## Product journeys

- Candidate email/password registration, career-profile intake, generated assessment, 24-hour review status, and published results
- Subjective written answers, audio communication evidence, and role × industry job simulations
- Reviewer registration with up to five roles and five industries, admin approval, and expertise-based assignment
- Two independent rubric-level reviews per assessment
- Admin comparison, adjudication, and final result publication
- Transactional email outbox for assignments, reviewer approval, and result publication
- Assessment generation from 8 core competencies, 90 roles, 60 industries, and a tagged 7,118-item question bank

## Run the portal

```bash
npm install
npm run dev
```

Without production environment variables, the portal runs in a persistent local preview mode. Preview credentials are shown on the sign-in screen. Local mode is for product testing only; it stores state in the browser.

## Production backend

The production database contract is in [`supabase/migrations/202608160001_zobology_portal.sql`](supabase/migrations/202608160001_zobology_portal.sql). It provides:

- Supabase Auth-linked candidate, reviewer, and admin profiles
- row-level security by account role and assignment
- reviewer expertise and approval controls
- server-side best-match assignment of up to two independent reviewers
- assessment, rubric review, adjudication, notification-outbox, and audit tables
- automatic movement to adjudication after two completed reviews

Transactional email delivery is implemented in [`supabase/functions/send-notifications/index.ts`](supabase/functions/send-notifications/index.ts) using Resend. Schedule the function with Supabase Cron and provide the secrets listed in [`.env.example`](.env.example).

Before public launch, connect the portal data adapter to the deployed Supabase project, create the first admin profile through a controlled migration, configure private storage buckets for audio/resumes, and remove local preview credentials.

## Checks

```bash
npm run lint
npm run build
```

The assessment taxonomy and bank model are documented in [`docs/question-bank.md`](docs/question-bank.md).
