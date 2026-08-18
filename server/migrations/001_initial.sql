create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  role text not null check (role in ('candidate', 'reviewer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists reviewer_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  role_ids text[] not null,
  industry_ids text[] not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references users(id),
  check (cardinality(role_ids) between 1 and 5),
  check (cardinality(industry_ids) between 1 and 5)
);

create table if not exists candidate_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text not null,
  education text not null,
  experience_type text not null check (experience_type in ('fresher', 'experienced')),
  experience_years numeric(4,1),
  target_role_id text not null,
  target_industry_id text not null,
  target_level text not null,
  resume_key text,
  updated_at timestamptz not null default now(),
  check (experience_years is null or experience_years between 0 and 50)
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references users(id),
  profile_snapshot jsonb not null,
  role_snapshot jsonb not null,
  industry_snapshot jsonb not null,
  questions jsonb not null,
  answers jsonb not null,
  status text not null default 'awaiting_review' check (status in ('awaiting_review', 'under_review', 'adjudication', 'published')),
  submitted_at timestamptz not null default now(),
  review_due_at timestamptz not null default (now() + interval '24 hours'),
  adjudicated_at timestamptz,
  adjudicated_by uuid references users(id),
  final_answers jsonb,
  check (jsonb_typeof(questions) = 'array'),
  check (jsonb_typeof(answers) = 'object')
);

create table if not exists review_assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  reviewer_id uuid not null references users(id),
  match_score smallint not null check (match_score between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'completed')),
  rubric_scores jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (assessment_id, reviewer_id)
);

create table if not exists stored_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  assessment_id uuid references assessments(id) on delete cascade,
  object_key text not null unique,
  kind text not null check (kind in ('audio', 'resume')),
  content_type text not null,
  original_name text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references users(id),
  event_type text not null check (event_type in ('review_assigned', 'reviewer_approved', 'results_ready')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

create index if not exists sessions_token_idx on user_sessions(token_hash, expires_at);
create index if not exists assessments_candidate_idx on assessments(candidate_id, submitted_at desc);
create index if not exists assessments_status_idx on assessments(status, review_due_at);
create unique index if not exists one_active_assessment_per_candidate on assessments(candidate_id) where status <> 'published';
create index if not exists assignments_reviewer_idx on review_assignments(reviewer_id, status, assigned_at);
create index if not exists files_assessment_idx on stored_files(assessment_id);
create index if not exists notifications_unsent_idx on notification_outbox(created_at) where sent_at is null;
