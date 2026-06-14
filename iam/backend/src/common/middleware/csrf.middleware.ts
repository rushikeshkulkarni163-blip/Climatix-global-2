import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF for GET/HEAD/OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.path.endsWith('/csrf-token')) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie('cx_csrf', token, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
        res.json({ csrfToken: token });
        return;
      }
      return next();
    }

    // Validate CSRF token for state-changing requests
    const cookieToken = req.cookies?.cx_csrf;
    const headerToken = req.headers['x-csrf-token'] as string;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      // Skip CSRF for JWT Bearer auth (API clients)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        return next();
      }
      throw new ForbiddenException('CSRF token mismatch.');
    }

    next();
  }
}
