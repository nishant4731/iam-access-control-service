import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../interfaces/auth-context.interface';
import { getRequest } from '../utils/request-context.util';

/**
 * Injects the authenticated principal (AuthContext) into a resolver argument.
 * Populated by JwtAuthGuard. Usage: `@CurrentUser() user: AuthContext`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined => {
    const req = getRequest(context) as unknown as { user?: AuthContext };
    return req.user;
  },
);
