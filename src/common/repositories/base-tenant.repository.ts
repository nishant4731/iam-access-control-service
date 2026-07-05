/**
 * Base class for every tenant-scoped repository.
 *
 * It guarantees that `tenantId` is merged into the `where` clause of every read
 * and into the `data` of every create — no concrete repository can accidentally
 * issue an unscoped query. `tenantId` is always supplied by the caller from the
 * verified AuthContext, never from client input.
 *
 * The delegate is typed structurally against the subset of the Prisma model
 * delegate we use, keeping the base reusable across all models.
 */
export interface PrismaModelDelegate<T> {
  findMany: (args?: any) => Promise<T[]>;
  findFirst: (args?: any) => Promise<T | null>;
  create: (args: any) => Promise<T>;
  update: (args: any) => Promise<T>;
  updateMany: (args: any) => Promise<{ count: number }>;
  delete: (args: any) => Promise<T>;
  deleteMany: (args: any) => Promise<{ count: number }>;
  count: (args?: any) => Promise<number>;
}

export abstract class BaseTenantRepository<T> {
  /**
   * Concrete repositories pass their specific Prisma model delegate to `super()`.
   * Keeping it here removes the identical `get delegate()` boilerplate that would
   * otherwise be repeated in every repository.
   */
  protected constructor(protected readonly delegate: PrismaModelDelegate<T>) {}

  /** Merge tenant scope into any where clause. */
  protected scopedWhere(tenantId: string, where: Record<string, any> = {}): Record<string, any> {
    return { ...where, tenantId };
  }

  findMany(
    tenantId: string,
    where: Record<string, any> = {},
    args: Record<string, any> = {},
  ): Promise<T[]> {
    return this.delegate.findMany({ ...args, where: this.scopedWhere(tenantId, where) });
  }

  findFirst(
    tenantId: string,
    where: Record<string, any> = {},
    args: Record<string, any> = {},
  ): Promise<T | null> {
    return this.delegate.findFirst({ ...args, where: this.scopedWhere(tenantId, where) });
  }

  findById(tenantId: string, id: string, args: Record<string, any> = {}): Promise<T | null> {
    return this.delegate.findFirst({ ...args, where: this.scopedWhere(tenantId, { id }) });
  }

  count(tenantId: string, where: Record<string, any> = {}): Promise<number> {
    return this.delegate.count({ where: this.scopedWhere(tenantId, where) });
  }

  create(tenantId: string, data: Record<string, any>): Promise<T> {
    return this.delegate.create({ data: { ...data, tenantId } });
  }

  /**
   * Scoped update: only rows matching both `id` and `tenantId` are affected.
   * Returns the updated row, or null if it did not belong to the tenant.
   */
  async updateById(
    tenantId: string,
    id: string,
    data: Record<string, any>,
  ): Promise<T | null> {
    const result = await this.delegate.updateMany({
      where: this.scopedWhere(tenantId, { id }),
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findById(tenantId, id);
  }

  /** Scoped delete: only affects rows within the tenant. */
  async deleteById(tenantId: string, id: string): Promise<boolean> {
    const result = await this.delegate.deleteMany({
      where: this.scopedWhere(tenantId, { id }),
    });
    return result.count > 0;
  }
}
