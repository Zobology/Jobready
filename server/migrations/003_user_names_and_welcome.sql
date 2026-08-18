alter table users add column if not exists first_name text;
alter table users add column if not exists last_name text;

alter table users
  drop constraint if exists users_first_name_check;
alter table users
  add constraint users_first_name_check
  check (first_name is null or char_length(trim(first_name)) between 1 and 80);

alter table users
  drop constraint if exists users_last_name_check;
alter table users
  add constraint users_last_name_check
  check (last_name is null or char_length(trim(last_name)) between 1 and 80);

alter table notification_outbox
  drop constraint if exists notification_outbox_event_type_check;

alter table notification_outbox
  add constraint notification_outbox_event_type_check
  check (event_type in (
    'candidate_welcome',
    'assessment_submitted',
    'review_assigned',
    'reviewer_application_received',
    'reviewer_approved',
    'reviewer_rejected',
    'results_ready'
  ));
