import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { resetStorage } from './util.js';

const { axiosGet, instanceGet } = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  instanceGet: vi.fn(),
}));

// jellyfin.js builds a fresh axios client per call (client()) and also calls
// the global axios for the unauthenticated ping. We stub both.
vi.mock('axios', () => {
  // jellyfin.js attaches a response interceptor to every client it creates.
  const makeInstance = () => ({
    get: instanceGet,
    interceptors: { response: { use: vi.fn() } },
  });
  return { default: { get: axiosGet, create: vi.fn(makeInstance) } };
});

// specificAlbumGet pulls analysis from audiomuse; stub that boundary so this
// file stays about Jellyfin normalisation only (routes.test.js covers the full
// flow with the real audiomuse path mocked out differently).
vi.mock('../util/audiomuse.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAudioFeaturesMap: vi.fn(async (ids) => new Map(ids.map((id) => [id, undefined]))),
  };
});

import {
  pingJellyfin,
  normalizeReleaseDate,
  normalizeAlbumSummary,
  normalizeTrack,
  normalizeDuration,
  searchAlbums,
  searchArtistAlbum,
  listAllAlbums,
  specificAlbumGet,
  getAlbumTracks,
} from '../util/jellyfin.js';
import { getFromCache } from '../util/cache.js';

beforeAll(resetStorage);

describe('normalizeDuration', () => {
  it('converts 100ns ticks to milliseconds', () => {
    expect(normalizeDuration(2122000000)).toBe(212200);
  });
  it('returns 0 for missing ticks', () => {
    expect(normalizeDuration(undefined)).toBe(0);
    expect(normalizeDuration(0)).toBe(0);
  });
});

describe('normalizeReleaseDate', () => {
  it('prefers ProductionYear', () => {
    expect(normalizeReleaseDate({ ProductionYear: 1999, PremiereDate: '2000-01-01T00:00:00Z' })).toBe(
      '1999'
    );
  });
  it('falls back to the date part of PremiereDate', () => {
    expect(normalizeReleaseDate({ PremiereDate: '1997-06-02T12:00:00Z' })).toBe('1997-06-02');
  });
  it('returns an empty string when neither exists', () => {
    expect(normalizeReleaseDate({})).toBe('');
  });
});

describe('normalizeAlbumSummary', () => {
  it('normalises a Jellyfin album into the frontend shape', () => {
    const summary = normalizeAlbumSummary({
      Id: 'alb-1',
      Name: 'Discovery',
      ChildCount: 14,
      ProductionYear: 2001,
      AlbumArtists: [{ Id: 'ar-1', Name: 'Daft Punk' }],
      ImageTags: { Primary: 'tag' },
    });
    expect(summary).toEqual({
      id: 'alb-1',
      name: 'Discovery',
      album_type: 'album',
      artists: [{ id: 'ar-1', name: 'Daft Punk', type: 'artist' }],
      release_date: '2001',
      images: [{ url: '/api/image/alb-1', height: 300, width: 300 }],
      total_tracks: 14,
      type: 'album',
      uri: 'jellyfin:album:alb-1',
    });
  });

  it('exposes no image without a Primary tag (frontend placeholder)', () => {
    const summary = normalizeAlbumSummary({ Id: 'x', Name: 'n' });
    expect(summary.images).toEqual([]);
  });

  it('total_tracks reports 0 when ChildCount/SongCount are missing', () => {
    expect(normalizeAlbumSummary({ Id: 'x', Name: 'n' }).total_tracks).toBe(0);
  });

  it('falls back to the string AlbumArtist when there are no artist refs', () => {
    const summary = normalizeAlbumSummary({ Id: 'x', Name: 'n', AlbumArtist: 'Unknown' });
    expect(summary.artists).toEqual([{ id: '', name: 'Unknown', type: 'artist' }]);
  });
});

describe('normalizeTrack', () => {
  it('normalises a Jellyfin audio item into a track', () => {
    const track = normalizeTrack({
      Id: 'tr-1',
      Name: 'One More Time',
      Album: 'Discovery',
      RunTimeTicks: 2120000000,
      IndexNumber: 1,
      ParentIndexNumber: 1,
      ArtistItems: [{ Id: 'ar-1', Name: 'Daft Punk' }],
    });
    expect(track).toMatchObject({
      id: 'tr-1',
      name: 'One More Time',
      album: 'Discovery',
      duration_ms: 212000,
      track_number: 1,
      disc_number: 1,
      type: 'track',
      uri: 'jellyfin:track:tr-1',
    });
  });
});

describe('searchAlbums', () => {
  const albs = (items) => ({ data: { Items: items } });

  beforeEach(() => {
    instanceGet.mockReset();
  });

  it('merges an album-name search with an album-artist search (deduped)', async () => {
    // 1st call: name search; 2nd: artists lookup; 3rd: albums by artist
    instanceGet
      .mockImplementationOnce(async (url) => {
        expect(url).toBe('/Items');
        return albs([
          { Id: 'dup', Name: 'Via Artist Match', AlbumArtists: [{ Id: 'a1', Name: 'Foo' }] },
          { Id: 'only-name', Name: 'Unique', AlbumArtists: [{ Id: 'a2', Name: 'Bar' }] },
        ]);
      })
      .mockImplementationOnce(async () => {
        expect('/Artists/AlbumArtists').toBeTruthy();
        return { data: { Items: [{ Id: 'a1', StrArtist: 'Foo' }] } };
      })
      .mockImplementationOnce(async (url, config) => {
        expect(config.params.albumArtistIds).toBe('a1');
        return albs([{ Id: 'dup', Name: 'Same Album Returned Again' }]);
      });

    const results = await searchAlbums('foo');
    expect(results).toHaveLength(2); // dup appears once
    expect(results.map((r) => r.id).sort()).toEqual(['dup', 'only-name']);
  });

  it('still returns the name-search results when the artist pass fails', async () => {
    instanceGet
      .mockImplementationOnce(async () => albs([{ Id: 'x-1', Name: 'X' }]))
      .mockImplementationOnce(async () => {
        throw new Error('artist endpoint down');
      });

    const results = await searchAlbums('x');
    expect(results.map((r) => r.id)).toEqual(['x-1']);
  });
});

describe('listAllAlbums', () => {
  it('pages the library until a short page is returned', async () => {
    const page = (n) => ({
      data: { Items: Array.from({ length: n }, (_, i) => ({ Id: `id-${i}`, Name: `alb-${i}` })) },
    });
    const pages = [page(500), page(500), page(3)];
    let call = 0;
    instanceGet.mockImplementation(async (_url, cfg) => {
      expect(cfg.params.startIndex).toBe(call * 500);
      return pages[call++];
    });

    const albums = await listAllAlbums();
    expect(albums).toHaveLength(1003);
    expect(instanceGet).toHaveBeenCalledTimes(3);
  });
});

describe('getAlbumTracks', () => {
  it('requests audio children sorted and returns the Items array', async () => {
    instanceGet.mockImplementationOnce(async (_url, cfg) => {
      expect(cfg.params.parentId).toBe('alb-9');
      expect(cfg.params.includeItemTypes).toBe('Audio');
      expect(cfg.params.sortBy).toBe('ParentIndexNumber,IndexNumber,SortName');
      return { data: { Items: [{ Id: 't1', Name: 'track' }] } };
    });
    const tracks = await getAlbumTracks('alb-9');
    expect(tracks.map((t) => t.Id)).toEqual(['t1']);
  });
});

describe('pingJellyfin', () => {
  beforeEach(() => axiosGet.mockReset());

  it('reports reachable+authenticated+version when everything is up', async () => {
    axiosGet.mockResolvedValueOnce({ data: { Version: '10.9.8' } }); // /System/Info/Public
    instanceGet.mockResolvedValueOnce({ data: [] }); // /Users
    const p = await pingJellyfin();
    expect(p).toEqual({ reachable: true, authenticated: true, version: '10.9.8', error: null });
  });

  it('reports unreachable when the public endpoint fails', async () => {
    axiosGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const p = await pingJellyfin();
    expect(p.reachable).toBe(false);
    expect(p.authenticated).toBe(false);
    expect(p.error).toBe('ECONNREFUSED');
  });

  it('reports unauthenticated when /Users rejects with a 401 message', async () => {
    axiosGet.mockResolvedValueOnce({ data: { Version: '1' } });
    instanceGet.mockRejectedValueOnce(new Error('401 unauthorized'));
    const p = await pingJellyfin();
    expect(p.reachable).toBe(true);
    expect(p.authenticated).toBe(false);
    expect(p.error).toContain('401');
  });
});

describe('searchArtistAlbum', () => {
  beforeEach(() => instanceGet.mockReset());

  it('prefers the candidate matching the requested artist over the first match', async () => {
    // album search term "Unknown Album": first call returns 2 albums
    instanceGet
      .mockImplementationOnce(async () => ({
        data: {
          Items: [
            { Id: 'want', Name: 'Unknown Album', AlbumArtists: [{ Id: 'a', Name: 'Quux' }] },
            { Id: 'first', Name: 'Other', AlbumArtists: [{ Id: 'b', Name: 'Zed' }] },
          ],
        },
      }))
      .mockImplementationOnce(async () => ({ data: { Items: [] } })); // artist pass

    const picked = await searchArtistAlbum('Quux', 'Unknown Album');
    expect(picked.id).toBe('want');
  });

  it('falls back to the first candidate when the artist does not match', async () => {
    instanceGet
      .mockImplementationOnce(async () => ({
        data: { Items: [{ Id: 'first', Name: 'Some', AlbumArtists: [{ Id: 'b', Name: 'Zed' }] }] },
      }))
      .mockImplementationOnce(async () => ({ data: { Items: [] } }));

    const picked = await searchArtistAlbum('Nobody', 'Some');
    expect(picked.id).toBe('first');
  });

  it('returns null when there are no candidates', async () => {
    instanceGet
      .mockImplementationOnce(async () => ({ data: { Items: [] } }))
      .mockImplementationOnce(async () => ({ data: { Items: [] } }));
    expect(await searchArtistAlbum('a', 'b')).toBeNull();
  });
});

describe('specificAlbumGet', () => {
  const albumItem = {
    Id: 'alb-cache',
    Name: 'Cached Album',
    ProductionYear: 2010,
    AlbumArtists: [{ Id: 'a', Name: 'Artist' }],
  };
  const trackItem = {
    Id: 'tr-1',
    Name: 'Song',
    Album: 'Cached Album',
    RunTimeTicks: 10000000, // 1000ms
    IndexNumber: 1,
    ParentIndexNumber: 1,
    ArtistItems: [{ Id: 'a', Name: 'Artist' }],
  };
  const raw = {
    album: normalizeAlbumSummary(albumItem),
    tracks: [normalizeTrack(trackItem)],
  };

  beforeEach(async () => {
    await resetStorage();
    axiosGet.mockReset();
    instanceGet.mockReset();
  });

  it('fetches and caches the raw album on first read, applying cached data on later reads', async () => {
    // Dispatch by URL: Promise.all(getAlbumDataById, getAlbumTracks) fires both
    // requests concurrently, so positional Queue mocks would race.
    instanceGet.mockImplementation(async (url, cfg) => {
      if (url === '/Items/alb-cache') {
        expect(cfg.params.userId).toBe('test-user-id');
        return { data: albumItem };
      }
      expect(url).toBe('/Items');
      expect(cfg.params.parentId).toBe('alb-cache');
      return { data: { Items: [trackItem] } };
    });
    const first = await specificAlbumGet('alb-cache');
    expect(first.name).toBe('Cached Album');
    expect(first.release_date).toBe('2010');
    expect(first.tracks[0].id).toBe('tr-1');
    // audioFeatures key exists (analysis map was stubbed) but is undefined
    expect(first.tracks[0]).toHaveProperty('audioFeatures');

    // Cached raw album is what got stored
    expect(await getFromCache('jf-alb-cache')).toEqual(raw);

    // Second call: cache hit, no upstream requests
    instanceGet.mockImplementation(async () => {
      throw new Error('unexpected upstream request');
    });
    axiosGet.mockImplementation(async () => {
      throw new Error('unexpected upstream request');
    });
    const second = await specificAlbumGet('alb-cache');
    expect(second).toEqual({ ...raw.album, tracks: [{ ...raw.tracks[0], audioFeatures: undefined }] });
  });

  it('throws "Album not found" when the upstream item is missing', async () => {
    instanceGet.mockImplementation(async (url) => {
      if (/^\/Items\/[^/]+/.test(url)) return { data: {} }; // no Id
      return { data: { Items: [] } };
    });
    await expect(specificAlbumGet('missing')).rejects.toThrow(/not found/i);
  });
});
