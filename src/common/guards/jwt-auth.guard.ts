import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthContext, JwtPayload } from '../interfaces/auth-context.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';
import { getRequest } from '../utils/request-context.util';
import { ServiceIdentitiesService } from '../../service-identities/service-identities.service';

export const API_KEY_HEADER = 'x-api-key';

/**
 * Authenticates the caller and attaches a fully-populated AuthContext to the
 * request. Two principal types are supported:
 *   • End users   — `Authorization: Bearer <JWT>` (access token).
 *   • Services    — `x-api-key: <serviceIdentityId>.<secret>` (service-to-service).
 *
 * Operations annotated with @Public (login, refreshToken, health) bypass it.
 *
 * The tenantId used everywhere downstream is taken from the *verified token /
 * service identity*, never from client input — the backbone of tenant isolation.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly serviceIdentities: ServiceIdentitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = getRequest(context) as any;
    const correlationId = req.headers?.[CORRELATION_ID_HEADER];

    // Service-to-service path: x-api-key.
    const apiKey: string | undefined = req.headers?.[API_KEY_HEADER];
    if (apiKey) {
      const principal = await this.serviceIdentities.validateApiKey(apiKey);
      if (!principal) {
        throw new UnauthorizedException('Invalid service API key');
      }
      req.user = {
        userId: principal.id,
        tenantId: principal.tenantId,
        roles: ['service'],
        permissions: ['*'],
        isService: true,
        correlationId,
      } satisfies AuthContext;
      return true;
    }

    // End-user path: bearer JWT (must be an access token).
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token or API key');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh tokens cannot be used to authorize requests');
    }

    req.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      isService: payload.isService ?? false,
      correlationId,
    } satisfies AuthContext;
    return true;
  }

  private extractToken(req: any): string | undefined {
    const header: string | undefined = req.headers?.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? value : undefined;
  }
}
