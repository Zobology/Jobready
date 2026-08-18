alter table review_assignments drop constraint if exists review_assignments_status_check;

update review_assignments
set status = 'available'
where status = 'pending';

alter table review_assignments alter column status set default 'available';

alter table review_assignments
  add constraint review_assignments_status_check
  check (status in ('available', 'accepted', 'declined', 'in_review', 'completed'));

update assessments a
set status = 'awaiting_review'
where a.status = 'under_review'
  and not exists (
    select 1
    from review_assignments ra
    where ra.assessment_id = a.id
      and ra.status in ('accepted', 'in_review', 'completed')
  );
