export type UserRole = "admin" | "analyst" | "viewer" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization?: string;
  plan: "free" | "professional" | "enterprise";
  permissions: Permission[];
  createdAt: string;
  lastLoginAt?: string;
}

export type Permission =
  | "terminal:read"
  | "terminal:write"
  | "simulation:run"
  | "risk:full"
  | "portfolio:manage"
  | "admin:content"
  | "admin:users"
  | "reports:generate"
  | "api:access"
  | "esg:scanner";

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  organization?: string;
  role?: UserRole;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  plan: string;
  permissions: Permission[];
  iat: number;
  exp: number;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}
