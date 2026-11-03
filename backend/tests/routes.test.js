import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PassThrough } from 'stream';
import { resetStorage } from './util.js';

const m = vi.hoisted(() => ({
  getUserInfo: vi.fn(async () => ({ sub: 'sub-routes' })),
  pingJellyfin: vi.fn(),
  specificAlbumGet: vi.fn(),
  searchAlbums: vi.fn(),
  searchArtistAlbum: vi.fn(),
  listAllAlbums: vi.fn(),
  fetchImage: vi.fn(),
  fetchAudio: vi.fn(),
  pingAudioMuse: vi.fn(),
}));

vi.mock('../util/user.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getUserInfo: m.getUserInfo };
});
vi.mock('../util/jellyfin.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    pingJellyfin: m.pingJellyfin,
    specificAlbumGet: m.specificAlbumGet,
    searchAlbums: m.searchAlbums,
    searchArtistAlbum: m.searchArtistAlbum,
    listAllAlbums: m.listAllAlbums,
    fetchImage: m.fetchImage,
    fetchAudio: m.fetchAudio,
  };
});
vi.mock('../util/audiomuse.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, pingAudioMuse: m.pingAudioMuse };
});

import app from '../app.js';

const AUTH = { Authorization: 'Bearer test-token' };

const album = (id, extra = {}) => ({
  id,
  name: `Album ${id}`,
  album_type: 'album',
  artists: [{ id: 'a1', name: 'Artist', type: 'artist' }],
  release_date: '2020',
  images: [],
  total_tracks: 0,
  type: 'album',
  uri: `jellyfin:album:${id}`,
  tracks: [],
  ...extra,
});

beforeAll(resetStorage);

function pipeBody(text) {
  const s = new PassThrough();
  s.end(text);
  return s;
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.getUserInfo.mockImplementation(async () => ({ sub: 'sub-routes' }));
});

describe('GET /api (smoke)', () => {
  it('responds OK', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });
});

describe('GET /api/health', () => {
  it('200 with ok=true when both services are healthy', async () => {
    m.pingJellyfin.mockResolvedValue({ reachable: true, authenticated: true, version: '1', error: null });
    m.pingAudioMuse.mockResolvedValue({ reachable: true, version: '2', error: null });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      jellyfin: { reachable: true, authenticated: true, version: '1', error: null },
      audiomuse: { reachable: true, version: '2', error: null },
    });
  });

  it('503 when either service is down', async () => {
    m.pingJellyfin.mockResolvedValue({ reachable: true, authenticated: false, version: null, error: '401' });
    m.pingAudioMuse.mockResolvedValue({ reachable: true, version: null, error: null });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });
});

describe('GET /api/search', () => {
  it('returns album summaries', async () => {
    m.searchAlbums.mockResolvedValue([album('s1')]);
    const res = await request(app).get('/api/search?q=discovery');
    expect(res.status).toBe(200);
    expect(m.searchAlbums).toHaveBeenCalledWith('discovery');
    expect(res.body[0].id).toBe('s1');
  });

  it('502 with the error message on upstream failure', async () => {
    m.searchAlbums.mockRejectedValue(new Error('Jellyfin authentication failed (401)'));
    const res = await request(app).get('/api/search?q=x');
    expect(res.status).toBe(502);
    expect(res.text).toContain('401');
  });
});

describe('GET /api/all-albums', () => {
  it('returns the whole library', async () => {
    m.listAllAlbums.mockResolvedValue([album('l1'), album('l2')]);
    const res = await request(app).get('/api/all-albums');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
  it('502 on failure', async () => {
    m.listAllAlbums.mockRejectedValue(new Error('boom'));
    expect((await request(app).get('/api/all-albums')).status).toBe(502);
  });
});

describe('GET /api/album-by-id/:id', () => {
  it('returns the hydrated album merged with the user tags for it', async () => {
    m.specificAlbumGet.mockResolvedValue(album('alb-1', { tracks: [] }));
    const res = await request(app).get('/api/album-by-id/alb-1').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]); // user has not collected it yet
  });

  it('merges the collection tags for a collected album', async () => {
    m.specificAlbumGet.mockResolvedValue(album('alb-2'));
    await request(app).post('/api/user/collection/add').set(AUTH).send({ ids: ['alb-2'] });
    await saveTagDirect('alb-2', ['funk', 'soul']);
    const res = await request(app).get('/api/album-by-id/alb-2').set(AUTH);
    expect(res.body.tags).toEqual(['funk', 'soul']);
  });

  it('404 when the upstream message says "not found"', async () => {
    m.specificAlbumGet.mockRejectedValue(new Error('Album not found'));
    expect((await request(app).get('/api/album-by-id/nope').set(AUTH)).status).toBe(404);
  });

  it('502 for other upstream errors', async () => {
    m.specificAlbumGet.mockRejectedValue(new Error('connection reset'));
    expect((await request(app).get('/api/album-by-id/x').set(AUTH)).status).toBe(502);
  });

  it('403 without an Authorization header', async () => {
    expect((await request(app).get('/api/album-by-id/x')).status).toBe(403);
  });
});

async function saveTagDirect(id, tags) {
  // The app has no dedicated tag endpoint yet; tags arrive via POST /user.
  const res = await request(app).get('/api/user').set(AUTH);
  res.body.collection.find((c) => c.id === id).tags = tags;
  await request(app).post('/api/user').set(AUTH).send(res.body);
}

describe('GET /api/album-search', () => {
  it('resolves artist+album to an id and returns the hydrated album', async () => {
    m.searchArtistAlbum.mockResolvedValue(album('found'));
    m.specificAlbumGet.mockResolvedValue(album('found', { name: 'Hydrated' }));
    const res = await request(app).get('/api/album-search?artist=A&album=B');
    expect(m.searchArtistAlbum).toHaveBeenCalledWith('A', 'B');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Hydrated');
  });

  it('404 when nothing matches', async () => {
    m.searchArtistAlbum.mockResolvedValue(null);
    const res = await request(app).get('/api/album-search?artist=A&album=B');
    expect(res.status).toBe(404);
  });
});

describe('media proxies', () => {
  it('GET /api/image/:id pipes bytes with content-type and cache headers', async () => {
    m.fetchImage.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'image/png' },
      data: pipeBody('PNGDATA'),
    });
    const res = await request(app).get('/api/image/x1');
    expect(m.fetchImage).toHaveBeenCalledWith('x1', 300); // default size
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toContain('max-age=86400');
    // Binary body is piped straight through; supertest exposes it as a buffer
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.toString()).toBe('PNGDATA');
  });

  it('passes ?size= through as the requested dimensions', async () => {
    m.fetchImage.mockResolvedValue({ status: 200, headers: {}, data: pipeBody('') });
    await request(app).get('/api/image/x1?size=600');
    expect(m.fetchImage).toHaveBeenCalledWith('x1', 600);
  });

  it('forwards upstream >=400 statuses for images', async () => {
    m.fetchImage.mockResolvedValue({ status: 404, headers: {}, data: pipeBody('') });
    expect((await request(app).get('/api/image/x1')).status).toBe(404);
  });

  it('GET /api/stream/:id forwards Range and the audio headers', async () => {
    m.fetchAudio.mockResolvedValue({
      status: 206,
      headers: {
        'content-type': 'audio/mpeg',
        'content-length': '5',
        'content-range': 'bytes 0-4/99',
        'accept-ranges': 'bytes',
      },
      data: pipeBody('hello'),
    });
    const res = await request(app).get('/api/stream/x2').set('Range', 'bytes=0-4');
    expect(m.fetchAudio).toHaveBeenCalledWith('x2', 'bytes=0-4');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-4/99');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.body.toString()).toBe('hello');
  });

  it('GET /api/stream/:id returns 404 when fetching throws', async () => {
    m.fetchAudio.mockRejectedValue(new Error('boom'));
    expect((await request(app).get('/api/stream/x3')).status).toBe(404);
  });
});

describe('POST /api/csv', () => {
  it('looks up each row and reports unfound rows as strings', async () => {
    m.searchArtistAlbum.mockImplementationOnce(async () => album('csv-1'))
      .mockImplementationOnce(async () => {
        throw new Error('nope');
      });
    const res = await request(app)
      .post('/api/csv')
      .set(AUTH)
      .attach('csv', Buffer.from('Artist,Title\nA,Album A\nB,Album B\n'), 'list.csv');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe('csv-1');
    expect(res.body[1]).toBe('Album not found: B - Album B');
  });

  it('400 when the upload parses to zero rows', async () => {
    const res = await request(app).post('/api/csv').set(AUTH).attach('csv', Buffer.from(''), 'x.csv');
    expect(res.status).toBe(400);
    expect(res.text).toContain("Can't parse file as CSV");
  });
});

describe('user + collection routes', () => {
  beforeEach(resetStorage);

  it('GET /api/user returns fresh {sets, collection} for a new user', async () => {
    const res = await request(app).get('/api/user').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sets: [], collection: [] });
  });

  it('403 without auth', async () => {
    expect((await request(app).get('/api/user')).status).toBe(403);
  });

  it('GET /api/user hydrates the collection with ?c=true, dropping unresolvable ids', async () => {
    await request(app).post('/api/user/collection/add').set(AUTH).send({ ids: ['ok-1', 'dead-1'] });
    m.specificAlbumGet.mockImplementation(async (id) => {
      if (id === 'dead-1') throw new Error('Album not found');
      return album(id, { name: `hydrated ${id}` });
    });
    const res = await request(app).get('/api/user?c=true').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.collection).toHaveLength(1);
    expect(res.body.collection[0].name).toBe('hydrated ok-1');
    expect(res.body.collection[0].tags).toEqual([]);
  });

  it('GET /api/user?c=false does not hydrate (stays dehydrated)', async () => {
    await request(app).post('/api/user/collection/add').set(AUTH).send({ ids: ['ok-2'] });
    const res = await request(app).get('/api/user?c=false').set(AUTH);
    expect(res.body.collection[0]).toEqual({ id: 'ok-2', tags: [] });
  });

  it('POST /api/user persists the body and returns the stored data', async () => {
    const data = { sets: [{ id: 'abc12345', created: 1, name: 'X', tracks: [] }], collection: [{ id: 'c1', tags: [] }] };
    const res = await request(app).post('/api/user').set(AUTH).send(data);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
    // persisted: a fresh GET returns the saved body
    const again = await request(app).get('/api/user').set(AUTH);
    expect(again.body).toEqual(data);
  });

  it('POST /api/user/collection/add deduplicates ids', async () => {
    const first = await request(app).post('/api/user/collection/add').set(AUTH).send({ ids: ['d1', 'd2'] });
    expect(first.body.collection.map((c) => c.id)).toEqual(['d1', 'd2']);
    const second = await request(app).post('/api/user/collection/add').set(AUTH).send({ ids: ['d2', 'd3'] });
    expect(second.body.collection.map((c) => c.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('PUT /api/user/collection/add/:id adds once (idempotent)', async () => {
    await request(app).put('/api/user/collection/add/p1').set(AUTH);
    const second = await request(app).put('/api/user/collection/add/p1').set(AUTH);
    expect(second.body.collection.filter((c) => c.id === 'p1')).toHaveLength(1);
  });

  it('PUT /api/user/collection/remove/:id removes, and is a no-op for unknown ids', async () => {
    await request(app).put('/api/user/collection/add/r1').set(AUTH);
    const removed = await request(app).put('/api/user/collection/remove/r1').set(AUTH);
    expect(removed.body.collection.map((c) => c.id)).toEqual([]);
    const again = await request(app).put('/api/user/collection/remove/r1').set(AUTH);
    expect(again.status).toBe(200);
    expect(again.body.collection).toEqual([]);
  });

  it('POST /api/user/set/new creates a set with an 8-hex id and empty tracks by default', async () => {
    const res = await request(app).post('/api/user/set/new').set(AUTH).send({});
    expect(res.status).toBe(200);
    expect(res.body.sets).toHaveLength(1);
    const set = res.body.sets[0];
    expect(set.id).toMatch(/^[0-9a-f]{8}$/);
    expect(typeof set.created).toBe('number');
    expect(set.tracks).toEqual([]);
    expect(typeof set.name).toBe('string');
  });

  it('POST /api/user/set/new stores the posted tracks', async () => {
    const tracks = [{ id: 't1', name: 'Song' }];
    const res = await request(app).post('/api/user/set/new').set(AUTH).send({ tracks });
    expect(res.body.sets[0].tracks).toEqual(tracks);
    // persisted
    const again = await request(app).get('/api/user').set(AUTH);
    expect(again.body.sets).toHaveLength(1);
  });
});
