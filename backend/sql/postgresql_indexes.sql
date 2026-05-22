-- SoftTurn PostgreSQL performance indexes
-- Apply this after initial Prisma migration if you need extra tuning.

CREATE INDEX IF NOT EXISTS idx_tickets_waiting_by_branch
  ON tickets (branch_id, service_type_id, created_at)
  WHERE status = 'WAITING';

CREATE INDEX IF NOT EXISTS idx_tickets_in_progress_by_operator
  ON tickets (operator_id, started_at)
  WHERE status = 'IN_PROGRESS';

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_desc
  ON ticket_events (ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_retry
  ON notifications (status, created_at)
  WHERE status = 'FAILED';

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_shifts_open
  ON operator_shifts (workplace_id, user_id)
  WHERE status = 'OPEN';
