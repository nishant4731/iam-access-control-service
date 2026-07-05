import { Policy as PolicyModel } from '@prisma/client';
import { PolicyCondition } from './contracts/policy-condition.contract';
import { Policy } from './entities/policy.entity';

export class PolicyMapper {
  static toEntity(model: PolicyModel): Policy {
    return {
      id: model.id,
      tenantId: model.tenantId,
      name: model.name,
      description: model.description,
      effect: model.effect,
      action: model.action,
      resourceType: model.resourceType,
      priority: model.priority,
      enabled: model.enabled,
      conditions: (model.conditions ?? {}) as PolicyCondition,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntities(models: PolicyModel[]): Policy[] {
    return models.map((m) => PolicyMapper.toEntity(m));
  }

  /** Extracts the typed condition document from a persistence model. */
  static conditionOf(model: PolicyModel): PolicyCondition {
    return (model.conditions ?? {}) as PolicyCondition;
  }
}
