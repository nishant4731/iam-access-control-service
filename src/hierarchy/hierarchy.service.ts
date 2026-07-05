import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RelationshipType } from '../common/enums/relationship-type.enum';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Maintains and queries the organization hierarchy CLOSURE TABLE.
 *
 * The closure table stores one row for every (ancestor, descendant) pair —
 * including the self pair at depth 0. Authorization therefore never walks the
 * manager chain recursively; every relationship question is a single indexed
 * lookup.
 */
@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

  /**
   * Registers a brand-new user as a hierarchy node by inserting its self-row
   * (depth 0). Idempotent. Runs inside the caller's transaction when supplied.
   */
  async addNode(tenantId: string, userId: string, tx: Tx = this.prisma): Promise<void> {
    await tx.organizationHierarchyClosure.createMany({
      data: [{ tenantId, ancestorUserId: userId, descendantUserId: userId, depth: 0 }],
      skipDuplicates: true,
    });
  }

  /**
   * Attaches (or re-parents) `userId`'s subtree under `managerId`, keeping the
   * closure table fully consistent. Prevents cycles.
   */
  async assignManager(tenantId: string, userId: string, managerId: string): Promise<void> {
    if (userId === managerId) {
      throw new BadRequestException('A user cannot be their own manager');
    }

    await this.prisma.$transaction(async (tx) => {
      // Ensure both nodes exist in the closure table.
      await this.addNode(tenantId, userId, tx);
      await this.addNode(tenantId, managerId, tx);

      // Cycle check: managerId must not already be a descendant of userId.
      const wouldCycle = await tx.organizationHierarchyClosure.findFirst({
        where: { tenantId, ancestorUserId: userId, descendantUserId: managerId },
      });
      if (wouldCycle) {
        throw new BadRequestException('Assigning this manager would create a cycle');
      }

      // Subtree of userId (all descendants incl. self).
      const subtree = await tx.organizationHierarchyClosure.findMany({
        where: { tenantId, ancestorUserId: userId },
        select: { descendantUserId: true, depth: true },
      });
      // Ancestors of managerId (incl. self).
      const superTree = await tx.organizationHierarchyClosure.findMany({
        where: { tenantId, descendantUserId: managerId },
        select: { ancestorUserId: true, depth: true },
      });

      const subtreeIds = subtree.map((s) => s.descendantUserId);
      // Proper ancestors of userId (its old parents), to detach.
      const oldAncestors = await tx.organizationHierarchyClosure.findMany({
        where: { tenantId, descendantUserId: userId, NOT: { ancestorUserId: userId } },
        select: { ancestorUserId: true },
      });
      const oldAncestorIds = oldAncestors.map((a) => a.ancestorUserId);

      // Detach the subtree from any previous ancestors (re-parenting).
      if (oldAncestorIds.length > 0) {
        await tx.organizationHierarchyClosure.deleteMany({
          where: {
            tenantId,
            descendantUserId: { in: subtreeIds },
            ancestorUserId: { in: oldAncestorIds },
          },
        });
      }

      // Cross-join: every ancestor of the new manager × every descendant of the
      // user, with summed depth + 1 for the new edge.
      const rows: Prisma.OrganizationHierarchyClosureCreateManyInput[] = [];
      for (const anc of superTree) {
        for (const desc of subtree) {
          rows.push({
            tenantId,
            ancestorUserId: anc.ancestorUserId,
            descendantUserId: desc.descendantUserId,
            depth: anc.depth + desc.depth + 1,
          });
        }
      }
      if (rows.length > 0) {
        await tx.organizationHierarchyClosure.createMany({ data: rows, skipDuplicates: true });
      }

      // Persist the denormalised managerId edge on the user row too.
      await tx.user.updateMany({ where: { id: userId, tenantId }, data: { managerId } });
    });
  }

  // ---------------------------------------------------------------------------
  // Queries (single indexed lookups — no recursion)
  // ---------------------------------------------------------------------------

  async isDirectManager(tenantId: string, subjectId: string, targetId: string): Promise<boolean> {
    const row = await this.prisma.organizationHierarchyClosure.findFirst({
      where: { tenantId, ancestorUserId: subjectId, descendantUserId: targetId, depth: 1 },
    });
    return !!row;
  }

  async isAncestor(tenantId: string, subjectId: string, targetId: string): Promise<boolean> {
    const row = await this.prisma.organizationHierarchyClosure.findFirst({
      where: { tenantId, ancestorUserId: subjectId, descendantUserId: targetId, depth: { gte: 1 } },
    });
    return !!row;
  }

  /**
   * Classifies the subject's relationship to the target within the hierarchy.
   * Returns the strongest applicable relationship.
   */
  async getRelationship(
    tenantId: string,
    subjectId: string,
    targetId: string,
  ): Promise<RelationshipType> {
    if (subjectId === targetId) {
      return RelationshipType.SELF;
    }

    const directRow = await this.prisma.organizationHierarchyClosure.findFirst({
      where: { tenantId, ancestorUserId: subjectId, descendantUserId: targetId, depth: { gte: 1 } },
    });
    if (directRow) {
      return directRow.depth === 1 ? RelationshipType.DIRECT_MANAGER : RelationshipType.ANCESTOR;
    }

    // Siblings: share the same direct manager (depth-1 ancestor).
    const [subjMgr, targetMgr] = await Promise.all([
      this.directManagerId(tenantId, subjectId),
      this.directManagerId(tenantId, targetId),
    ]);
    if (subjMgr && targetMgr && subjMgr === targetMgr) {
      return RelationshipType.SIBLING;
    }

    return RelationshipType.NONE;
  }

  private async directManagerId(tenantId: string, userId: string): Promise<string | null> {
    const row = await this.prisma.organizationHierarchyClosure.findFirst({
      where: { tenantId, descendantUserId: userId, depth: 1 },
      select: { ancestorUserId: true },
    });
    return row?.ancestorUserId ?? null;
  }

  async getAncestors(tenantId: string, userId: string): Promise<{ userId: string; depth: number }[]> {
    const rows = await this.prisma.organizationHierarchyClosure.findMany({
      where: { tenantId, descendantUserId: userId, depth: { gte: 1 } },
      orderBy: { depth: 'asc' },
      select: { ancestorUserId: true, depth: true },
    });
    return rows.map((r) => ({ userId: r.ancestorUserId, depth: r.depth }));
  }

  async getDescendants(tenantId: string, userId: string): Promise<{ userId: string; depth: number }[]> {
    const rows = await this.prisma.organizationHierarchyClosure.findMany({
      where: { tenantId, ancestorUserId: userId, depth: { gte: 1 } },
      orderBy: { depth: 'asc' },
      select: { descendantUserId: true, depth: true },
    });
    return rows.map((r) => ({ userId: r.descendantUserId, depth: r.depth }));
  }
}
