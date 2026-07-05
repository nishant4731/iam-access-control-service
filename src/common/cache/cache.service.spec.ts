import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  it('stores and retrieves a value', () => {
    cache.set('k', 42, 1000);
    expect(cache.get<number>('k')).toBe(42);
  });

  it('returns undefined for a missing key', () => {
    expect(cache.get('nope')).toBeUndefined();
  });

  it('expires values after their TTL', () => {
    cache.set('k', 'v', 1000);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 2000; // jump past the TTL
      expect(cache.get('k')).toBeUndefined();
    } finally {
      Date.now = realNow;
    }
  });

  it('invalidates by prefix', () => {
    cache.set('perms:t1:u1', ['a'], 1000);
    cache.set('perms:t1:u2', ['b'], 1000);
    cache.set('perms:t2:u1', ['c'], 1000);
    cache.delByPrefix('perms:t1:');
    expect(cache.get('perms:t1:u1')).toBeUndefined();
    expect(cache.get('perms:t1:u2')).toBeUndefined();
    expect(cache.get('perms:t2:u1')).toEqual(['c']);
  });

  it('wrap() loads once then serves from cache', async () => {
    const loader = jest.fn().mockResolvedValue('loaded');
    const a = await cache.wrap('k', 1000, loader);
    const b = await cache.wrap('k', 1000, loader);
    expect(a).toBe('loaded');
    expect(b).toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
