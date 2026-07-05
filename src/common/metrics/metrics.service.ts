import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics for the authorization service. Exposed at GET /metrics.
 * The key SLO signals are decision latency and allow/deny rates, plus cache
 * effectiveness (hit ratio) which is what makes the service scale.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly decisions = new Counter({
    name: 'iam_authorization_decisions_total',
    help: 'Total authorization decisions',
    labelNames: ['tenant', 'effect'] as const,
    registers: [this.registry],
  });

  private readonly decisionLatency = new Histogram({
    name: 'iam_authorization_decision_duration_ms',
    help: 'Authorization decision latency in milliseconds',
    labelNames: ['effect'] as const,
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500],
    registers: [this.registry],
  });

  private readonly cacheOps = new Counter({
    name: 'iam_cache_operations_total',
    help: 'Cache hits and misses',
    labelNames: ['cache', 'result'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordDecision(tenant: string, effect: string, durationMs: number): void {
    this.decisions.inc({ tenant, effect });
    this.decisionLatency.observe({ effect }, durationMs);
  }

  recordCache(cache: string, result: 'hit' | 'miss'): void {
    this.cacheOps.inc({ cache, result });
  }

  contentType(): string {
    return this.registry.contentType;
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
