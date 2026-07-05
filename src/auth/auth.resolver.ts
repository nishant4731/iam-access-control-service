import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { AuthPayload } from './entities/auth-payload.type';
import { ServiceAuthPayload } from './entities/service-auth-payload.type';

@Resolver(() => AuthPayload)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => AuthPayload, {
    description: 'Authenticate a user and receive access + refresh tokens.',
  })
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  @Public()
  @Mutation(() => AuthPayload, {
    description: 'Exchange a refresh token for a new access token.',
  })
  refreshToken(@Args('refreshToken') refreshToken: string): Promise<AuthPayload> {
    return this.authService.refresh(refreshToken);
  }

  @Public()
  @Mutation(() => ServiceAuthPayload, {
    description: 'Exchange a service API key for a short-lived service JWT (service-to-service).',
  })
  issueServiceToken(@Args('apiKey') apiKey: string): Promise<ServiceAuthPayload> {
    return this.authService.issueServiceToken(apiKey);
  }
}
