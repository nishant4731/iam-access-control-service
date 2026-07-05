import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Prisma } from '@prisma/client';

/**
 * Global exception filter producing a consistent, safe error shape and never
 * leaking internal details (stack traces, SQL) to clients. Works for both HTTP
 * and GraphQL transports. Prisma known errors are mapped to sensible codes.
 */
@Catch()
export class GlobalExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const { status, code, message } = this.normalize(exception);

    this.logger.error(
      `[${code}] ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // GraphQL transport: surface a clean GraphQLError.
    if (host.getType<GqlContextType>() === 'graphql') {
      GqlArgumentsHost.create(host);
      return new GraphQLError(message, {
        extensions: { code, statusCode: status },
      });
    }

    // HTTP transport (health endpoint etc.)
    const res = host.switchToHttp().getResponse();
    if (res && typeof res.status === 'function') {
      res.status(status).json({ statusCode: status, code, message });
    }
    return undefined;
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as any)?.message ?? exception.message);
      return {
        status: exception.getStatus(),
        code: this.codeForStatus(exception.getStatus()),
        message: Array.isArray(message) ? message.join('; ') : message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'A record with the same unique fields already exists',
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Requested record was not found',
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private codeForStatus(status: number): string {
    return (
      {
        [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
        [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
        [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
        [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
        [HttpStatus.CONFLICT]: 'CONFLICT',
      }[status] ?? 'ERROR'
    );
  }
}
