import axios from 'axios';
import { getFromCache, storeInCache } from './cache.js';
import Logger from './logger.js';
import { getAudioFeaturesMap } from './audiomuse.js';

const API = (process.env.JELLYFIN_URL || '').replace(/\/$/, '');
const API_KEY = process.env.JELLYFIN_API_KEY || '';
if (!API) Logger.debug('JELLYFIN_URL is not set; Jellyfin requests will fail. Set it in backend/.env.');
if (!API_KEY) Logger.debug('JELLYFIN_API_KEY is not set; Jellyfin requests will be rejected.');

const AUTH_HEADERS = {
  Authorization: `MediaBrowser Token="${API_KEY}"`,
};

// Cache keys are namespaced so they never collide with the old Spotify cache files
const cacheKey = (id) => `jf-${id}`;

function client() {
  const c = axios.create({ baseURL: API, headers: AUTH_HEADERS });
  // Turn opaque axios failures into messages that say what actually broke.
  c.interceptors.response.use(
    (r) => r,
    (error) => {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        error.message =
          `Jellyfin authentication failed (${status}). ` +
          'JELLYFIN_API_KEY is invalid or was revoked (e.g. after a Jellyfin upgrade).';
      } else if (status) {
        error.message = `Jellyfin request failed (${status}) for ${error.config?.url}`;
      }
      return Promise.reject(error);
    }
  );
  return c;
}

// Health probe used by GET /api/health. `reachable` uses the public endpoint (no
// auth); `authenticated` exercises the API key.
export async function pingJellyfin() {
  const result = { reachable: false, authenticated: false, version: null, error: null };
  try {
    const { data } = await axios.get(`${API}/System/Info/Public`, { timeout: 10000 });
    result.reachable = true;
    result.version = data?.Version ?? null;
  } catch (e) {
    result.error = e.message;
    return result;
  }
  try {
    await client().get('/Users', { timeout: 10000 });
    result.authenticated = true;
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

let cachedUserId = null;
// The single-item endpoint requires a userId; resolve one (prefer an admin)
// lazily and reuse it.
async function getUserId() {
  if (cachedUserId) return cachedUserId;
  if (process.env.JELLYFIN_USER_ID) {
    cachedUserId = process.env.JELLYFIN_USER_ID;
    return cachedUserId;
  }
  const { data } = await client().get('/Users');
  const users = Array.isArray(data) ? data : [];
  const admin = users.find((u) => u.Policy?.IsAdministrator) || users[0];
  if (!admin?.Id) throw new Error('No Jellyfin users found');
  cachedUserId = admin.Id;
  return cachedUserId;
}

// ---------------------------------------------------------------------------
// Normalisation helpers: map Jellyfin's BaseItemDto shape onto the (Spotify-ish)
// shape the frontend already understands.
// ---------------------------------------------------------------------------

function artistRefs(item) {
  const items = item?.ArtistItems ?? item?.AlbumArtists ?? [];
  if (items.length) {
    return items.map((a) => ({ id: a.Id, name: a.Name, type: 'artist' }));
  }
  const name = item?.AlbumArtist || item?.Artists?.[0];
  return name ? [{ id: '', name, type: 'artist' }] : [];
}

export function normalizeReleaseDate(item) {
  if (item?.ProductionYear) return String(item.ProductionYear);
  if (item?.PremiereDate) return String(item.PremiereDate).split('T')[0];
  return '';
}

function normalizeImages(item) {
  // Only expose an image when Jellyfin actually has a primary tag, otherwise the
  // frontend falls back to its placeholder.
  if (!item?.ImageTags?.Primary) return [];
  return [{ url: `/api/image/${item.Id}`, height: 300, width: 300 }];
}

export function normalizeDuration(ticks) {
  if (!ticks) return 0;
  return Math.round(ticks / 10000); // ticks are 100ns units -> ms
}

export function normalizeAlbumSummary(item) {
  return {
    id: item.Id,
    name: item.Name,
    album_type: 'album',
    artists: artistRefs(item),
    release_date: normalizeReleaseDate(item),
    images: normalizeImages(item),
    total_tracks: item.ChildCount ?? item.SongCount ?? 0,
    type: 'album',
    uri: `jellyfin:album:${item.Id}`,
  };
}

export function normalizeTrack(item) {
  return {
    id: item.Id,
    name: item.Name,
    artists: artistRefs(item),
    album: item.Album,
    duration_ms: normalizeDuration(item.RunTimeTicks),
    track_number: item.IndexNumber ?? 0,
    disc_number: item.ParentIndexNumber ?? 0,
    type: 'track',
    uri: `jellyfin:track:${item.Id}`,
  };
}

// ---------------------------------------------------------------------------
// Jellyfin queries
// ---------------------------------------------------------------------------

export async function getAlbumDataById(id) {
  const userId = await getUserId();
  const { data } = await client().get(`/Items/${id}`, {
    params: {
      userId,
      fields: 'Artists,AlbumArtist,ArtistItems,ProductionYear,ChildCount,ImageTags,RunTimeTicks',
    },
  });
  return data;
}

export async function getAlbumTracks(id) {
  const { data } = await client().get(`/Items`, {
    params: {
      parentId: id,
      includeItemTypes: 'Audio',
      recursive: true,
      sortBy: 'ParentIndexNumber,IndexNumber,SortName',
      fields: 'Artists,AlbumArtist,ArtistItems,RunTimeTicks,IndexNumber,ParentIndexNumber,PremiereDate',
      limit: 1000,
    },
  });
  return data.Items ?? [];
}

export async function searchAlbums(query) {
  const c = client();
  const found = new Map();

  // 1) Album name / metadata search
  const params = {
    includeItemTypes: 'MusicAlbum',
    recursive: true,
    searchTerm: query,
    limit: 30,
    fields: 'Artists,AlbumArtist,ArtistItems,ProductionYear,ChildCount,ImageTags',
  };
  const { data: byName } = await c.get('/Items', { params });
  (byName.Items ?? []).forEach((i) => found.set(i.Id, normalizeAlbumSummary(i)));

  // 2) Artist search -> that artist's albums (Jellyfin's album search does not
  //    match artist names, so we do this second pass explicitly).
  try {
    const { data: artists } = await c.get('/Artists/AlbumArtists', {
      params: { searchTerm: query, limit: 10 },
    });
    const ids = (artists.Items ?? []).map((a) => a.Id).filter(Boolean);
    if (ids.length) {
      const { data: byArtist } = await c.get('/Items', {
        params: {
          includeItemTypes: 'MusicAlbum',
          recursive: true,
          albumArtistIds: ids.join(','),
          limit: 40,
          fields: 'Artists,AlbumArtist,ArtistItems,ProductionYear,ChildCount,ImageTags',
        },
      });
      (byArtist.Items ?? []).forEach((i) => found.set(i.Id, normalizeAlbumSummary(i)));
    }
  } catch (e) {
    Logger.debug(`Artist search failed for "${query}": ${e.message}`);
  }

  return [...found.values()];
}

// List every album in the library, paging until Jellyfin runs out. Used by the
// collection import screen so the user can pick from the whole library.
export async function listAllAlbums() {
  const c = client();
  const albums = [];
  const pageSize = 500;
  let startIndex = 0;

  while (true) {
    const { data } = await c.get('/Items', {
      params: {
        includeItemTypes: 'MusicAlbum',
        recursive: true,
        startIndex,
        limit: pageSize,
        sortBy: 'SortName',
        fields: 'Artists,AlbumArtist,ArtistItems,ProductionYear,ChildCount,ImageTags',
      },
    });
    const items = data.Items ?? [];
    items.forEach((i) => albums.push(normalizeAlbumSummary(i)));
    if (items.length < pageSize) break;
    startIndex += pageSize;
  }

  return albums;
}

export async function searchArtistAlbum(artist, album) {
  // Prefer a name search for the album, then keep the result whose album artist /
  // title matches the requested artist. Fall back to the first match.
  let candidates = [];
  if (album) candidates = await searchAlbums(album);
  if (artist) {
    const needle = String(artist).toLowerCase();
    const match = candidates.find((a) =>
      a.artists.some((ar) => ar.name.toLowerCase().includes(needle)) ||
      needle.includes(a.artists[0]?.name?.toLowerCase?.() ?? '\u0000')
    );
    if (match) return match;
  }
  if (candidates.length) return candidates[0];
  return null;
}

// Fetch an album plus its tracks, enriching each track with AudioMuse analysis.
// The raw album (metadata + tracks) is cached; analysis is applied on every read
// so re-analysing a track in AudioMuse is reflected without clearing the cache.
export async function specificAlbumGet(id) {
  const cached = await getFromCache(cacheKey(id));
  let raw = cached;
  if (!raw) {
    const [albumItem, tracks] = await Promise.all([getAlbumDataById(id), getAlbumTracks(id)]);
    if (!albumItem?.Id) throw new Error('Album not found');
    raw = {
      album: normalizeAlbumSummary(albumItem),
      tracks: tracks.map(normalizeTrack),
    };
    await storeInCache(cacheKey(id), raw);
  }

  const durationById = Object.fromEntries(raw.tracks.map((t) => [t.id, t.duration_ms]));
  const features = await getAudioFeaturesMap(
    raw.tracks.map((t) => t.id),
    durationById
  );

  const tracks = raw.tracks.map((t) => ({ ...t, audioFeatures: features.get(t.id) }));

  return { ...raw.album, tracks };
}

// ---------------------------------------------------------------------------
// Media proxies
// ---------------------------------------------------------------------------

// Returns the upstream axios response so routes can pipe the bytes.
export async function fetchImage(id, size = 300) {
  return client().get(`/Items/${id}/Images/Primary`, {
    params: { maxHeight: size, maxWidth: size, quality: 90 },
    responseType: 'stream',
    validateStatus: () => true,
  });
}

export async function fetchAudio(id, range) {
  const headers = { ...AUTH_HEADERS };
  if (range) headers.Range = range;
  return client().get(`/Audio/${id}/stream`, {
    params: { static: true },
    headers,
    responseType: 'stream',
    maxRedirects: 5,
    validateStatus: () => true,
  });
}
