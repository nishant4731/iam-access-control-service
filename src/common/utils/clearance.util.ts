import { ClearanceLevel } from '@prisma/client';

/**
 * Ordinal ranking for clearance / sensitivity comparison. A subject may access
 * a resource only if the subject's clearance rank is >= the resource's
 * sensitivity rank.
 */
const CLEARANCE_RANK: Record<ClearanceLevel, number> = {
  [ClearanceLevel.PUBLIC]: 0,
  [ClearanceLevel.INTERNAL]: 1,
  [ClearanceLevel.CONFIDENTIAL]: 2,
  [ClearanceLevel.SECRET]: 3,
  [ClearanceLevel.TOP_SECRET]: 4,
};

export function clearanceRank(level: ClearanceLevel): number {
  return CLEARANCE_RANK[level];
}

/**
 * True when `subject` clearance is sufficient for `required` sensitivity.
 */
export function meetsClearance(
  subject: ClearanceLevel,
  required: ClearanceLevel,
): boolean {
  return clearanceRank(subject) >= clearanceRank(required);
}
