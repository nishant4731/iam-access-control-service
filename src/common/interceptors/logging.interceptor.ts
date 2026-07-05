import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Emits a structured log line with latency for every resolver/route
 * invocation. The recorded duration is the primary performance-metrics hook —
 * a real deployment would forward it to Prometheus/OTel here.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Resolver');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = process.hrtime.bigint();
    const label = this.describe(context);

    return next.handle().pipe(
      tap({
        next: () => this.record(label, start, 'ok'),
        error: () => this.record(label, start, 'error'),
      }),
    );
  }

  private describe(context: ExecutionContext): string {
    if (context.getType<'graphql'>() === 'graphql') {
      const info = GqlExecutionContext.create(context).getInfo();
      return `${info?.parentType?.name}.${info?.fieldName}`;
    }
    return `${context.getClass().name}.${context.getHandler().name}`;
  }

  private record(label: string, start: bigint, outcome: string): void {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    this.logger.log({ resolver: label, outcome, durationMs: Number(durationMs.toFixed(2)) });
  }
}
