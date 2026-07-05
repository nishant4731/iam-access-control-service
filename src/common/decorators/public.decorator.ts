import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a resolver/route as not requiring authentication (e.g. `login`,
 * `health`). The JwtAuthGuard checks for this metadata and skips verification.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
