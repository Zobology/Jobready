alter table review_assignments add column if not exists accepted_at timestamptz;

update review_assignments
set accepted_at = coalesce(started_at, assigned_at)
where review_type = 'mentor'
  and status in ('accepted', 'in_review')
  and accepted_at is null;

alter table review_assignments drop constraint if exists review_assignments_status_check;

alter table review_assignments
  add constraint review_assignments_status_check
  check (status in ('available', 'accepted', 'declined', 'expired', 'in_review', 'completed'));

create index if not exists review_assignments_mentor_deadline_idx
  on review_assignments (accepted_at)
  where review_type = 'mentor' and status in ('accepted', 'in_review');
