import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuditLogInput {
  eventType: string;
  category: string;
  severity?: 'info' | 'warning' | 'critical' | 'alert';
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  organizationId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  resourcePath?: string;
  httpMethod?: string;
  httpStatus?: number;
  requestId?: string;
  outcome?: 'success' | 'failure' | 'denied';
  failureReason?: string;
  beforeState?: object;
  afterState?: object;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly dataSource: DataSource) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (
          event_type, category, severity, actor_id, actor_email, actor_role,
          target_type, target_id, organization_id, session_id, ip_address,
          user_agent, action, resource_path, http_method, http_status,
          request_id, outcome, failure_reason, before_state, after_state, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          input.eventType,
          input.category,
          input.severity || 'info',
          input.actorId || null,
          input.actorEmail || null,
          input.actorRole || null,
          input.targetType || null,
          input.targetId || null,
          input.organizationId || null,
          input.sessionId || null,
          input.ipAddress || null,
          input.userAgent || null,
          input.action,
          input.resourcePath || null,
          input.httpMethod || null,
          input.httpStatus || null,
          input.requestId || null,
          input.outcome || 'success',
          input.failureReason || null,
          input.beforeState ? JSON.stringify(input.beforeState) : null,
          input.afterState ? JSON.stringify(input.afterState) : null,
          JSON.stringify(input.metadata || {}),
        ],
      );
    } catch (err) {
      // Audit logging must never throw — log error but continue
      this.logger.error('Audit log write failed', err);
    }
  }

  async query(filters: {
    orgId?: string;
    userId?: string;
    eventType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const { orgId, userId, eventType, severity, startDate, endDate, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (orgId) { conditions.push(`organization_id = $${idx++}`); params.push(orgId); }
    if (userId) { conditions.push(`actor_id = $${idx++}`); params.push(userId); }
    if (eventType) { conditions.push(`event_type ILIKE $${idx++}`); params.push(`%${eventType}%`); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }
    if (startDate) { conditions.push(`created_at >= $${idx++}`); params.push(startDate); }
    if (endDate) { conditions.push(`created_at <= $${idx++}`); params.push(endDate); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT event_id, event_type, category, severity, actor_email, actor_role,
                target_type, target_id, ip_address, action, outcome, failure_reason, created_at
         FROM audit_logs ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as total FROM audit_logs ${where}`,
        params,
      ),
    ]);

    return { data: rows, total: parseInt(countRows[0].total, 10) };
  }

  async getSecurityEvents(orgId?: string, onlyOpen = false): Promise<any[]> {
    const conditions = onlyOpen ? 'AND se.is_resolved = FALSE' : '';
    return this.dataSource.query(
      `SELECT se.*, u.email as user_email
       FROM security_events se
       LEFT JOIN users u ON u.id = se.user_id
       WHERE ($1::uuid IS NULL OR se.organization_id = $1) ${conditions}
       ORDER BY se.risk_score DESC, se.created_at DESC
       LIMIT 100`,
      [orgId || null],
    );
  }
}
