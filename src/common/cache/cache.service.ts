import { Injectable, Optional } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * In-memory TTL cache with prefix-based invalidation.
 *
 * This is the local (L1) cache. The interface (get/set/del/delByPrefix/wrap) is
 * intentionally storage-agnostic so it can be backed by Redis (L2, shared
 * across replicas) in production by swapping the store — see DESIGN.md §8.
 * Authorization caches the two DB-heavy reads (subject permissions and
 * applicable policies), invalidated whenever roles/permissions/policies change.
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry>();

  constructor(@Optional() private readonly metrics?: MetricsService) {}

  get<T>(key: string, cacheName = 'default'): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.metrics?.recordCache(cacheName, 'miss');
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.metrics?.recordCache(cacheName, 'miss');
      return undefined;
    }
    this.metrics?.recordCache(cacheName, 'hit');
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate every key beginning with `prefix` (e.g. all of a tenant's policies). */
  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Get-or-load: returns the cached value, or runs `loader`, caches, and returns it. */
  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>, cacheName = 'default'): Promise<T> {
    const cached = this.get<T>(key, cacheName);
    if (cached !== undefined) {
      return cached;
    }
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }
}
