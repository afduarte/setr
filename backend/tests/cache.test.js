import { describe, it, expect, beforeAll } from 'vitest';
import { getFromCache, storeInCache } from '../util/cache.js';
import { resetStorage } from './util.js';

beforeAll(resetStorage);

describe('cache', () => {
  it('round-trips JSON data under the given id', async () => {
    await storeInCache('jf-abc', { album: 'Test', tracks: [{ id: 't1' }] });
    expect(await getFromCache('jf-abc')).toEqual({ album: 'Test', tracks: [{ id: 't1' }] });
  });

  it('returns null for a cache miss', async () => {
    expect(await getFromCache('jf-nonexistent')).toBeNull();
  });

  it('is write-once: a second store does not overwrite the first value', async () => {
    await storeInCache('jf-once', { version: 1 });
    await storeInCache('jf-once', { version: 2 });
    expect(await getFromCache('jf-once')).toEqual({ version: 1 });
  });

  it('drops undefined-valued keys when serialising', async () => {
    await storeInCache('jf-undef', { a: 1, b: undefined, c: null });
    const cached = await getFromCache('jf-undef');
    expect(cached).toEqual({ a: 1, c: null });
  });
});
