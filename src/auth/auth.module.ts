import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ServiceIdentitiesModule } from '../service-identities/service-identities.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

/**
 * Configures JWT signing/verification from environment-provided secrets and
 * exposes the login mutation. JwtModule is exported so the global JwtAuthGuard
 * can verify tokens.
 */
@Module({
  imports: [
    ServiceIdentitiesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  providers: [AuthService, AuthResolver],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
