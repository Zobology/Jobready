alter table stored_files drop constraint if exists stored_files_kind_check;
alter table stored_files add constraint stored_files_kind_check check (kind in ('audio', 'resume', 'answer_spreadsheet'));
