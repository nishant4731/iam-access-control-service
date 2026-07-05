import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from '../common/interfaces/auth-context.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceIdentitiesService } from '../service-identities/service-identities.service';
import { LoginInput } from './dto/login.input';
import { AuthPayload } from './entities/auth-payload.type';
import { ServiceAuthPayload } from './entities/service-auth-payload.type';

/**
 * Authenticates end users and issues JWTs. The token embeds the tenantId,
 * roles and permissions resolved *server-side* from the database — the client
 * never supplies these. Downstream, everything trusts the token, not the
 * request body, which is the foundation of tenant isolation.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly serviceIdentities: ServiceIdentitiesService,
  ) {}

  async login(input: LoginInput): Promise<AuthPayload> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant || tenant.status !== 'ACTIVE') {
      // Do not reveal whether the tenant or the user was the problem.
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.employmentStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const { roles, permissions } = await this.resolveAuthorities(tenant.id, user.id);
    return this.issueTokens(user.id, tenant.id, user.email, roles, permissions);
  }

  /**
   * Exchanges a valid refresh token for a fresh access token, re-reading the
   * user's current roles/permissions so revoked grants take effect immediately.
   *
   * NOTE (production): this is an unrotated stub. Production should persist
   * refresh tokens (or a jti), rotate them on use, and detect reuse — see
   * DESIGN.md §9.
   */
  async refresh(refreshToken: string): Promise<AuthPayload> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Provided token is not a refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
    });
    if (!user || user.employmentStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const { roles, permissions } = await this.resolveAuthorities(payload.tenantId, user.id);
    return this.issueTokens(user.id, payload.tenantId, user.email, roles, permissions);
  }

  /**
   * Exchanges a service API key for a short-lived **service JWT** (isService=true).
   * Services then call the API with `Authorization: Bearer <serviceToken>` instead
   * of passing the raw API key on every request. In production this pairs with
   * mTLS between services (see DESIGN.md §6).
   */
  async issueServiceToken(apiKey: string): Promise<ServiceAuthPayload> {
    const principal = await this.serviceIdentities.validateApiKey(apiKey);
    if (!principal) {
      throw new UnauthorizedException('Invalid service API key');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: principal.id,
      tenantId: principal.tenantId,
      roles: ['service'],
      permissions: ['*'],
      isService: true,
      type: 'access',
    } satisfies JwtPayload);

    return {
      accessToken,
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '1h'),
      tenantId: principal.tenantId,
      serviceName: principal.name,
    };
  }

  /** Signs a short-lived access token and a long-lived refresh token. */
  private async issueTokens(
    userId: string,
    tenantId: string,
    email: string,
    roles: string[],
    permissions: string[],
  ): Promise<AuthPayload> {
    const base = { sub: userId, tenantId, email, isService: false };

    const accessToken = await this.jwtService.signAsync({
      ...base,
      roles,
      permissions,
      type: 'access',
    } satisfies JwtPayload);

    const refreshToken = await this.jwtService.signAsync(
      { ...base, roles: [], permissions: [], type: 'refresh' } satisfies JwtPayload,
      { expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '1h'),
      userId,
      tenantId,
      email,
      roles,
      permissions,
    };
  }

  /**
   * Resolves the effective role names and permission names for a user via
   * UserRole → Role → RolePermission → Permission.
   */
  async resolveAuthorities(
    tenantId: string,
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { tenantId, userId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
      },
    });

    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const ur of userRoles) {
      roles.add(ur.role.name);
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.name);
      }
    }

    return { roles: [...roles], permissions: [...permissions] };
  }
}
