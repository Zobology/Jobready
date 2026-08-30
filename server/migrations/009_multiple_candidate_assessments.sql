drop index if exists one_active_assessment_per_candidate;

create unique index if not exists one_active_assessment_per_target
  on assessments (candidate_id, (role_snapshot->>'id'), (industry_snapshot->>'id'))
  where status <> 'published';
