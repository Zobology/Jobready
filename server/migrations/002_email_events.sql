alter table notification_outbox
  drop constraint if exists notification_outbox_event_type_check;

alter table notification_outbox
  add constraint notification_outbox_event_type_check
  check (event_type in (
    'assessment_submitted',
    'review_assigned',
    'reviewer_application_received',
    'reviewer_approved',
    'reviewer_rejected',
    'results_ready'
  ));
