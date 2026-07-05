import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthStatus } from './health.types';

const SERVICE_NAME = 'iam-access-control-service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Basic liveness. */
  liveness(): HealthStatus {
    return { status: 'ok', service: SERVICE_NAME, timestamp: new Date().toISOString() };
  }

  /** Readiness — verifies the database connection responds. */
  async readiness(): Promise<HealthStatus> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', service: SERVICE_NAME, timestamp: new Date().toISOString() };
  }
}
