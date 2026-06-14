import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import type { JwtPayload } from '../auth/auth.service';

const SENSITIVE_ROUTES = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/logout'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { url, method } = request;

    const isSensitive = SENSITIVE_ROUTES.some((r) => url.includes(r));
    if (!isSensitive) return next.handle();

    const start = Date.now();
    const user: JwtPayload | undefined = request.user;
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0] || request.socket.remoteAddress;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          if (user) {
            this.auditService.log({
              eventType: `http.${method.toLowerCase()}.${url.split('/').pop()}`,
              category: 'access',
              actorId: user.sub,
              actorEmail: user.email,
              sessionId: user.sessionId,
              action: `${method} ${url}`,
              httpMethod: method,
              httpStatus: response.statusCode,
              resourcePath: url,
              ipAddress: ip,
              requestId: request.headers['x-request-id'],
              outcome: 'success',
            });
          }
        },
        error: (err) => {
          if (user) {
            this.auditService.log({
              eventType: `http.${method.toLowerCase()}.error`,
              category: 'access',
              actorId: user.sub,
              actorEmail: user.email,
              action: `${method} ${url}`,
              httpMethod: method,
              httpStatus: err.status || 500,
              resourcePath: url,
              ipAddress: ip,
              outcome: 'failure',
              failureReason: err.message,
            });
          }
        },
      }),
    );
  }
}
