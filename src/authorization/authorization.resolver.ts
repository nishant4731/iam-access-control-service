import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { AuthorizationService } from './authorization.service';
import { CheckAccessInput } from './dto/check-access.input';
import { AccessDecisionResult } from './entities/access-decision.type';

@Resolver(() => AccessDecisionResult)
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Mutation(() => AccessDecisionResult, {
    description: 'Centralized authorization decision (RBAC + ABAC + ReBAC + policy engine).',
  })
  @UseGuards(TenantGuard)
  async checkAccess(
    @CurrentUser() principal: AuthContext,
    @Args('input') input: CheckAccessInput,
  ): Promise<AccessDecisionResult> {
    const decision = await this.authorizationService.checkAccess({
      // tenantId is taken from the verified token, not the input, as the source
      // of truth. The TenantGuard has already rejected any mismatching input.
      tenantId: principal.tenantId,
      subjectUserId: input.subjectUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceAttributes: this.parseJson(input.resourceAttributes, 'resourceAttributes'),
      subjectAttributes: this.parseJson(input.subjectAttributes, 'subjectAttributes'),
      correlationId: principal.correlationId,
    });

    return {
      allowed: decision.allowed,
      effect: decision.effect,
      reason: decision.reason,
      matchedPolicies: decision.matchedPolicies,
      decisionId: decision.decisionId,
      evaluationTrace: decision.evaluationTrace,
    };
  }

  private parseJson(value: string | undefined, field: string): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(`${field} must be a valid JSON object string`);
    }
  }
}
