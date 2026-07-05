import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

/**
 * Resolves the underlying Express request from either an HTTP or a GraphQL
 * execution context. Centralised so guards/decorators work transparently for
 * both transports.
 */
export function getRequest(context: ExecutionContext): Request {
  if (context.getType<'graphql'>() === 'graphql') {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().req;
  }
  return context.switchToHttp().getRequest<Request>();
}
