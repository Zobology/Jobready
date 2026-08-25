create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx
  on password_reset_tokens(user_id, created_at desc);

create index if not exists password_reset_tokens_active_idx
  on password_reset_tokens(expires_at)
  where used_at is null;

alter table notification_outbox
  drop constraint if exists notification_outbox_event_type_check;

alter table notification_outbox
  add constraint notification_outbox_event_type_check
  check (event_type in (
    'candidate_welcome',
    'assessment_submitted',
    'password_reset',
    'review_assigned',
    'reviewer_application_received',
    'reviewer_approved',
    'reviewer_rejected',
    'results_ready'
  ));
