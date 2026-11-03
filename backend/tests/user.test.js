import { describe, it, expect, beforeAll } from 'vitest';
import { saveUserData, getUserData, tokenMiddleware } from '../util/user.js';
import { resetStorage } from './util.js';

beforeAll(resetStorage);

// Minimal req/res doubles for the middleware
function middlewareProbe() {
  const req = { headers: {} };
  const res = { status: (s) => (res._status = s), sendStatus: (s) => (res._sent = s), ...{}, headers: {} };
  return {
    req,
    res,
    next: () => (req._advanced = true),
    result: () => ({ advanced: req._advanced, sent: res._sent ?? res._status }),
  };
}

describe('tokenMiddleware', () => {
  it('extracts the Bearer token onto req.token and calls next()', () => {
    const p = middlewareProbe();
    p.req.headers.authorization = 'Bearer my-jwt';
    tokenMiddleware(p.req, p.res, p.next);
    expect(p.req.token).toBe('my-jwt');
    expect(p.result().advanced).toBe(true);
  });

  it('sends 403 when the Authorization header is missing', () => {
    const p = middlewareProbe();
    tokenMiddleware(p.req, p.res, p.next);
    expect(p.result().sent).toBe(403);
    expect(p.result().advanced).toBeUndefined();
  });
});

describe('user data store', () => {
  it('creates an empty user file on first read', async () => {
    const data = await getUserData('sub-new-user');
    expect(data).toEqual({ sets: [], collection: [] });
  });

  it('round-trips saved user data', async () => {
    await saveUserData('sub-rt', {
      collection: [{ id: 'album-1', tags: ['banger'] }],
      sets: [{ id: 'aabbccdd', created: 1, name: 'Test Set', tracks: [] }],
    });
    const data = await getUserData('sub-rt');
    expect(data.collection).toEqual([{ id: 'album-1', tags: ['banger'] }]);
    expect(data.sets).toHaveLength(1);
  });

  it('overwrites previous data on save', async () => {
    await saveUserData('sub-overwrite', { sets: [], collection: [{ id: 'x', tags: [] }] });
    await saveUserData('sub-overwrite', { sets: [], collection: [{ id: 'y', tags: [] }] });
    expect(await getUserData('sub-overwrite')).toEqual({ sets: [], collection: [{ id: 'y', tags: [] }] });
  });
});
