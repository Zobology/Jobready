alter table review_assignments
  add column if not exists review_type text not null default 'mentor';

alter table review_assignments
  drop constraint if exists review_assignments_review_type_check;

alter table review_assignments
  add constraint review_assignments_review_type_check
  check (review_type in ('mentor', 'admin'));

create index if not exists assignments_admin_calibration_idx
  on review_assignments(reviewer_id, assessment_id, status)
  where review_type = 'admin';
