/**
 * The authenticated principal, derived exclusively from a verified JWT (or a
 * verified service identity). This is the ONLY trusted source of `tenantId`
 * for downstream repository scoping — the tenantId in a client payload is
 * never trusted.
 */
export interface AuthContext {
  /** User id for end-user tokens; service identity id for service tokens. */
  userId: string;
  tenantId: string;
  email?: string;
  roles: string[];
  permissions: string[];
  /** True when the principal is a service-to-service caller. */
  isService: boolean;
  correlationId?: string;
}

/** JWT payload shape issued by the auth module. */
export interface JwtPayload {
  sub: string;
  tenantId: string;
  email?: string;
  roles: string[];
  permissions: string[];
  isService: boolean;
  /** Distinguishes short-lived access tokens from long-lived refresh tokens. */
  type?: 'access' | 'refresh';
}
