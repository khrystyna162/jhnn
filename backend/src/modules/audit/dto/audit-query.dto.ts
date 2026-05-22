export class AuditQueryDto {
  action?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}
