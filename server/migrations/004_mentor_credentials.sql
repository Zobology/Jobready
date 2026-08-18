alter table reviewer_profiles add column if not exists linkedin_url text;
alter table reviewer_profiles add column if not exists resume_key text;

alter table reviewer_profiles
  drop constraint if exists reviewer_profiles_linkedin_url_check;
alter table reviewer_profiles
  add constraint reviewer_profiles_linkedin_url_check
  check (
    linkedin_url is null
    or linkedin_url ~* '^https://([a-z0-9-]+\.)?linkedin\.com/'
  );
