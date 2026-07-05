import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * Reusable pagination arguments for list queries. `take` is capped so a client
 * can never request an unbounded result set. Applied to users, departments,
 * roles, permissions and policies.
 */
@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  take?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;
}

/** Normalizes/clamps pagination into Prisma‑ready `{ take, skip }`. */
export function toPrismaPagination(args: PaginationArgs = {}): { take: number; skip: number } {
  const take = Math.min(Math.max(args.take ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const skip = Math.max(args.skip ?? 0, 0);
  return { take, skip };
}
