create table if not exists coaching_plans (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references assessments(id) on delete cascade,
  candidate_id uuid not null references users(id) on delete cascade,
  total_hours smallint not null check (total_hours in (2, 4, 8, 16, 24)),
  ai_hours smallint not null check (ai_hours >= 0),
  expert_hours smallint not null check (expert_hours >= 0),
  summary text not null,
  focus_areas jsonb not null check (jsonb_typeof(focus_areas) = 'array'),
  sessions jsonb not null check (jsonb_typeof(sessions) = 'array'),
  status text not null default 'under_review' check (status in ('under_review', 'published')),
  curated_by text not null,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ai_hours + expert_hours = total_hours),
  check (total_hours <> 2 or (ai_hours = 1 and expert_hours = 1)),
  check (total_hours = 2 or (ai_hours >= 1 and expert_hours >= 1)),
  check (jsonb_array_length(sessions) = total_hours)
);

create index if not exists coaching_plans_candidate_idx on coaching_plans(candidate_id, updated_at desc);
