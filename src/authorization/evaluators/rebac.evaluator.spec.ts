import { RelationshipType } from '../../common/enums/relationship-type.enum';
import { HierarchyService } from '../../hierarchy/hierarchy.service';
import { makeContext } from '../../../test/helpers/context.factory';
import { RebacEvaluator } from './rebac.evaluator';

describe('RebacEvaluator', () => {
  const hierarchy = {
    getRelationship: jest.fn(),
  } as unknown as jest.Mocked<HierarchyService>;
  const evaluator = new RebacEvaluator(hierarchy);

  beforeEach(() => jest.clearAllMocks());

  it('returns NONE when the resource has no owner', async () => {
    const ctx = makeContext({ resource: { ownerUserId: null } as any });
    await expect(evaluator.resolve(ctx)).resolves.toBe(RelationshipType.NONE);
    expect(hierarchy.getRelationship).not.toHaveBeenCalled();
  });

  it('delegates relationship resolution to the closure-table service', async () => {
    hierarchy.getRelationship.mockResolvedValue(RelationshipType.DIRECT_MANAGER);
    const ctx = makeContext({ resource: { ownerUserId: 'owner' } as any });
    await expect(evaluator.resolve(ctx)).resolves.toBe(RelationshipType.DIRECT_MANAGER);
    expect(hierarchy.getRelationship).toHaveBeenCalledWith('tenant-x', 'subject', 'owner');
  });

  describe('satisfies', () => {
    it('is unconstrained when no relationships are listed', () => {
      expect(evaluator.satisfies(undefined, RelationshipType.NONE)).toBe(true);
      expect(evaluator.satisfies([], RelationshipType.SIBLING)).toBe(true);
    });

    it('matches when the actual relationship is allowed', () => {
      expect(
        evaluator.satisfies([RelationshipType.DIRECT_MANAGER, RelationshipType.ANCESTOR], RelationshipType.ANCESTOR),
      ).toBe(true);
    });

    it('does not match when the actual relationship is excluded', () => {
      expect(
        evaluator.satisfies([RelationshipType.DIRECT_MANAGER], RelationshipType.SIBLING),
      ).toBe(false);
    });
  });
});
