alter table assessments add column if not exists ai_review_status text not null default 'pending'
  check (ai_review_status in ('pending', 'processing', 'completed', 'failed', 'unavailable'));
alter table assessments add column if not exists ai_review jsonb;
alter table assessments add column if not exists ai_model text;
alter table assessments add column if not exists ai_review_attempts smallint not null default 0;
alter table assessments add column if not exists ai_reviewed_at timestamptz;
alter table assessments add column if not exists ai_review_started_at timestamptz;
alter table assessments add column if not exists ai_review_error text;

create table if not exists ai_governance (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'human_required' check (mode in ('human_required', 'ai_only')),
  minimum_reviews integer not null default 100 check (minimum_reviews between 20 and 10000),
  maximum_mae numeric(4,3) not null default 0.350 check (maximum_mae between 0 and 3),
  minimum_exact_agreement numeric(4,3) not null default 0.750 check (minimum_exact_agreement between 0 and 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

insert into ai_governance(singleton) values (true) on conflict do nothing;

create table if not exists ai_human_calibration (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references assessments(id) on delete cascade,
  review_assignment_id uuid not null references review_assignments(id) on delete cascade,
  question_id text not null,
  dimension text not null,
  competency text not null,
  criterion text not null,
  ai_model text not null,
  ai_score smallint not null check (ai_score between 1 and 4),
  human_score smallint not null check (human_score between 1 and 4),
  absolute_delta smallint generated always as (abs(human_score - ai_score)) stored,
  exact_match boolean generated always as (human_score = ai_score) stored,
  created_at timestamptz not null default now(),
  unique(review_assignment_id, question_id, criterion)
);

create index if not exists ai_pending_reviews_idx on assessments(ai_review_status, submitted_at)
  where status <> 'published';
create index if not exists ai_calibration_competency_idx on ai_human_calibration(ai_model, competency, criterion, created_at desc);
