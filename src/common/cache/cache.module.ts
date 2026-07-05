import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global so any repository/service can read from or invalidate the cache.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
