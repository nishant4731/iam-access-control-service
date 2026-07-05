import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
// Side-effect import: registers all Prisma enums with the code-first schema.
import '../common/graphql/enums';
import { CacheModule } from '../common/cache/cache.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { AppLoggerModule } from '../common/logger/logger.module';
import { MetricsModule } from '../common/metrics/metrics.module';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DepartmentsModule } from '../departments/departments.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PoliciesModule } from '../policies/policies.module';
import { RolesModule } from '../roles/roles.module';
import { ServiceIdentitiesModule } from '../service-identities/service-identities.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { HealthController } from './health.controller';
import { HealthResolver } from './health.resolver';
import { HealthService } from './health.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppLoggerModule,
    MetricsModule,
    CacheModule,
    PrismaModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        playground: config.get('GRAPHQL_PLAYGROUND') === 'true',
        introspection: true,
        // Expose the raw request to guards/decorators via GraphQL context.
        context: ({ req }: { req: unknown }) => ({ req }),
        formatError: (error) => ({
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
        }),
      }),
    }),

    // Feature modules
    AuthModule,
    TenantsModule,
    DepartmentsModule,
    UsersModule,
    HierarchyModule,
    RolesModule,
    PermissionsModule,
    PoliciesModule,
    ServiceIdentitiesModule,
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    HealthResolver,
    // Global authentication guard (skips @Public handlers).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global structured logging + latency metrics.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
