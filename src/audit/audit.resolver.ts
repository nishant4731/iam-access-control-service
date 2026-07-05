import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { AccessAuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';

@Resolver(() => AccessAuditLog)
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => [AccessAuditLog], { description: 'Authorization audit logs for the caller tenant.' })
  auditLogs(
    @CurrentUser() user: AuthContext,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 50 }) take: number,
    @Args('subjectUserId', { type: () => ID, nullable: true }) subjectUserId?: string,
  ): Promise<AccessAuditLog[]> {
    return this.auditService.findMany(user.tenantId, take, subjectUserId);
  }
}
