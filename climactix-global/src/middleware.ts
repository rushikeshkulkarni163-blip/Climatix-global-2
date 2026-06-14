import { NextRequest, NextResponse } from 'next/server';

const IAM_URL = process.env.IAM_URL || 'http://localhost:3100/api/v1';

// Routes that require authentication
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/investor-terminal',
  '/terminal',
  '/simulation',
  '/climate-risk-os',
  '/portfolio',
  '/report',
  '/admin',
  '/settings',
  '/onboarding',
  '/risk-analysis',
  '/infrastructure',
];

// Auth pages — redirect away if already authenticated
const AUTH_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

// Role-gated routes: only these roles can access
const ROLE_ROUTES: Record<string, string[]> = {
  '/investor-terminal': ['investor', 'esg_analyst', 'super_admin', 'internal_admin'],
  '/terminal': ['investor', 'esg_analyst', 'super_admin', 'internal_admin'],
  '/admin': ['super_admin', 'internal_admin'],
};

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // IAM API routes — pass through
  if (pathname.startsWith('/api/')) return NextResponse.next();

  const accessToken = req.cookies.get('cx_access')?.value
    || req.cookies.get('climactix_token')?.value; // legacy cookie support

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Decode token
  let payload: Record<string, any> | null = null;
  if (accessToken) payload = decodeJwtPayload(accessToken);
  const isAuthenticated = !!payload;
  const userRoles: string[] = payload?.roles || (payload?.role ? [payload.role] : []);

  // Unauthenticated → protected route: redirect to login
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('cx_access');
    return res;
  }

  // Authenticated → auth route: redirect to dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Role-based access
  for (const [route, allowed] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route) && isAuthenticated) {
      const hasAccess = allowed.some((r) => userRoles.includes(r));
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/dashboard?error=access_denied', req.url));
      }
    }
  }

  // Forward user context to server components
  const res = NextResponse.next();
  if (payload) {
    res.headers.set('x-user-id', payload.sub || '');
    res.headers.set('x-user-email', payload.email || '');
    res.headers.set('x-user-roles', userRoles.join(','));
    res.headers.set('x-user-type', payload.userType || payload.role || '');
    res.headers.set('x-org-id', payload.orgId || '');
    res.headers.set('x-subscription-tier', payload.tier || 'free');
  }

  // Security headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$).*)'],
};
