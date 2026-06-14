/**
 * Climactix Global — IAM Client
 * Typed wrapper around the IAM service REST API.
 * All requests use HttpOnly cookies (credentials: 'include').
 */

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

export interface UserPayload {
  id: string;
  email: string;
  userType: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  tier: string;
  sessionId: string;
}

export interface AuthTokens {
  sessionId: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; success: boolean; error?: string }> {
  const res = await fetch(`${IAM_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    return { success: false, data: null as any, error: json.message || 'Request failed' };
  }
  return { success: true, data: json.data ?? json };
}

export const AuthClient = {
  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userType?: string;
    organizationName?: string;
  }) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },

  async login(payload: { email: string; password: string; rememberMe?: boolean }) {
    return request<{ mfaRequired?: boolean; challengeId?: string; sessionId?: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
    );
  },

  async logout() {
    return request('/auth/logout', { method: 'POST' });
  },

  async refresh() {
    return request('/auth/refresh', { method: 'POST' });
  },

  async me() {
    return request<UserPayload>('/auth/me');
  },

  async verifyEmail(token: string) {
    return request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
  },

  async forgotPassword(email: string) {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },

  async resetPassword(token: string, newPassword: string) {
    return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
  },

  async listSessions() {
    return request<any[]>('/sessions');
  },

  async revokeSession(sessionId: string) {
    return request(`/sessions/${sessionId}`, { method: 'DELETE' });
  },

  async revokeAllSessions() {
    return request('/auth/sessions', { method: 'DELETE' });
  },

  async getMfaStatus() {
    return request<{ enabled: boolean; method: string | null; backupCodesRemaining: number }>('/mfa/status');
  },

  async setupTotp() {
    return request<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>('/mfa/totp/setup', { method: 'POST' });
  },

  async enableTotp(totpCode: string, backupCodes: string[]) {
    return request('/mfa/totp/enable', { method: 'POST', body: JSON.stringify({ totpCode, backupCodes }) });
  },

  async disableTotp(totpCode: string) {
    return request('/mfa/totp/disable', { method: 'POST', body: JSON.stringify({ totpCode }) });
  },

  async verifyMfa(challengeId: string, code: string) {
    return request('/mfa/verify', { method: 'POST', body: JSON.stringify({ challengeId, code }) });
  },

  async getOrganization(orgId: string) {
    return request<any>(`/organizations/${orgId}`);
  },

  async listOrgMembers(orgId: string) {
    return request<any>(`/organizations/${orgId}/members`);
  },

  async inviteMember(orgId: string, email: string, roleId?: string) {
    return request(`/organizations/${orgId}/invite`, { method: 'POST', body: JSON.stringify({ email, roleId }) });
  },

  async getSubscriptionFeatures() {
    return request<any[]>('/subscriptions/features');
  },

  async hasPermission(permission: string, userPerms: string[]): Promise<boolean> {
    return userPerms.includes(permission) || userPerms.includes('platform:admin');
  },
};

// ── React hook ────────────────────────────────────────────────────────────────

export function useAuthGuard(requiredPermission?: string) {
  if (typeof window === 'undefined') return { user: null, loading: true };
  // Implemented as a hook in the consuming component with useState/useEffect
  return { user: null, loading: false };
}
