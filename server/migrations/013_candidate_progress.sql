create table if not exists assessment_drafts (
  candidate_id uuid primary key references users(id) on delete cascade,
  profile_snapshot jsonb not null,
  role_snapshot jsonb not null,
  industry_snapshot jsonb not null,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  current_question_index smallint not null default 0 check (current_question_index >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists coaching_session_progress (
  coaching_plan_id uuid not null references coaching_plans(id) on delete cascade,
  candidate_id uuid not null references users(id) on delete cascade,
  session_id text not null,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (coaching_plan_id, session_id)
);

create index if not exists coaching_progress_candidate_idx on coaching_session_progress(candidate_id, updated_at desc);
