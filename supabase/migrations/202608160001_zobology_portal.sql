create extension if not exists pgcrypto;

create type public.account_role as enum ('candidate', 'reviewer', 'admin');
create type public.reviewer_status as enum ('pending', 'approved', 'rejected');
create type public.assessment_status as enum ('awaiting_review', 'under_review', 'adjudication', 'published');
create type public.review_status as enum ('pending', 'in_review', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.account_role not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviewer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_ids text[] not null,
  industry_ids text[] not null,
  status public.reviewer_status not null default 'pending',
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  check (cardinality(role_ids) between 1 and 5),
  check (cardinality(industry_ids) between 1 and 5)
);

create table public.candidate_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text not null,
  education text not null,
  experience_type text not null check (experience_type in ('fresher', 'experienced')),
  experience_years numeric(4,1),
  target_role_id text not null,
  target_industry_id text not null,
  target_level text not null,
  resume_path text,
  updated_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id),
  profile_snapshot jsonb not null,
  role_snapshot jsonb not null,
  industry_snapshot jsonb not null,
  questions jsonb not null,
  answers jsonb not null,
  status public.assessment_status not null default 'awaiting_review',
  submitted_at timestamptz not null default now(),
  review_due_at timestamptz not null default (now() + interval '24 hours'),
  adjudicated_at timestamptz,
  adjudicated_by uuid references public.profiles(id),
  final_answers jsonb,
  constraint questions_is_array check (jsonb_typeof(questions) = 'array'),
  constraint answers_is_object check (jsonb_typeof(answers) = 'object')
);

create table public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  match_score smallint not null check (match_score between 1 and 3),
  status public.review_status not null default 'pending',
  rubric_scores jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (assessment_id, reviewer_id)
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id),
  event_type text not null check (event_type in ('review_assigned', 'reviewer_approved', 'results_ready')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assessments_candidate_idx on public.assessments(candidate_id, submitted_at desc);
create index assessments_status_idx on public.assessments(status, review_due_at);
create index assignments_reviewer_idx on public.review_assignments(reviewer_id, status, assigned_at);
create index notifications_unsent_idx on public.notification_outbox(created_at) where sent_at is null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when new.raw_user_meta_data ->> 'role' = 'reviewer'
      then 'reviewer'::public.account_role
      else 'candidate'::public.account_role
    end
  );
  return new;
end;
$$;

create trigger auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.assign_best_reviewers(p_assessment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_count integer;
begin
  with target as (
    select id, role_snapshot ->> 'id' as role_id, industry_snapshot ->> 'id' as industry_id
    from public.assessments where id = p_assessment_id
  ), ranked as (
    select rp.user_id,
      (case when t.role_id = any(rp.role_ids) then 2 else 0 end +
       case when t.industry_id = any(rp.industry_ids) then 1 else 0 end)::smallint as match_score,
      count(ra.id) filter (where ra.status <> 'completed') as open_work
    from public.reviewer_profiles rp
    cross join target t
    left join public.review_assignments ra on ra.reviewer_id = rp.user_id
    where rp.status = 'approved'
      and (t.role_id = any(rp.role_ids) or t.industry_id = any(rp.industry_ids))
    group by rp.user_id, t.role_id, t.industry_id, rp.role_ids, rp.industry_ids, rp.applied_at
    order by match_score desc, open_work asc, rp.applied_at asc
    limit 2
  ), inserted as (
    insert into public.review_assignments (assessment_id, reviewer_id, match_score)
    select p_assessment_id, user_id, match_score from ranked
    on conflict (assessment_id, reviewer_id) do nothing
    returning id, reviewer_id
  ), queued as (
    insert into public.notification_outbox (recipient_id, event_type, payload)
    select reviewer_id, 'review_assigned', jsonb_build_object('assessment_id', p_assessment_id, 'assignment_id', id)
    from inserted
    returning id
  )
  select count(*) into assigned_count from inserted;

  update public.assessments
  set status = case when exists(select 1 from public.review_assignments where assessment_id = p_assessment_id)
    then 'under_review'::public.assessment_status else 'awaiting_review'::public.assessment_status end
  where id = p_assessment_id;

  return assigned_count;
end;
$$;

create or replace function public.on_assessment_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_best_reviewers(new.id);
  return new;
end;
$$;

create trigger assessment_submitted
after insert on public.assessments
for each row execute function public.on_assessment_submitted();

create or replace function public.on_review_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count integer;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select count(*) into completed_count
    from public.review_assignments
    where assessment_id = new.assessment_id and status = 'completed';

    if completed_count >= 2 then
      update public.assessments set status = 'adjudication' where id = new.assessment_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger review_completed
after update on public.review_assignments
for each row execute function public.on_review_completed();

create or replace function public.on_reviewer_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, auth.uid());
    insert into public.notification_outbox (recipient_id, event_type, payload)
    values (new.user_id, 'reviewer_approved', jsonb_build_object('reviewer_id', new.user_id));
  end if;
  return new;
end;
$$;

create trigger reviewer_approved
before update on public.reviewer_profiles
for each row execute function public.on_reviewer_approved();

alter table public.profiles enable row level security;
alter table public.reviewer_profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.review_assignments enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy reviewers_self_read on public.reviewer_profiles for select using (user_id = auth.uid() or public.is_admin());
create policy reviewers_self_create on public.reviewer_profiles for insert with check (user_id = auth.uid());
create policy reviewers_admin_update on public.reviewer_profiles for update using (public.is_admin());
create policy candidates_self_all on public.candidate_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assessments_candidate_read on public.assessments for select using (candidate_id = auth.uid());
create policy assessments_candidate_create on public.assessments for insert with check (candidate_id = auth.uid());
create policy assessments_reviewer_read on public.assessments for select using (
  exists(select 1 from public.review_assignments where assessment_id = assessments.id and reviewer_id = auth.uid())
);
create policy assessments_admin_all on public.assessments for all using (public.is_admin()) with check (public.is_admin());
create policy assignments_reviewer_read on public.review_assignments for select using (reviewer_id = auth.uid() or public.is_admin());
create policy assignments_reviewer_update on public.review_assignments for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy notifications_self_read on public.notification_outbox for select using (recipient_id = auth.uid() or public.is_admin());
create policy audit_admin_read on public.audit_log for select using (public.is_admin());

revoke all on function public.assign_best_reviewers(uuid) from public, anon, authenticated;
grant execute on function public.assign_best_reviewers(uuid) to service_role;
