import { Router } from 'express';
import multer from 'multer';
import neatCsv from 'neat-csv';
import {
  specificAlbumGet,
  searchAlbums,
  searchArtistAlbum,
  listAllAlbums,
  fetchImage,
  fetchAudio,
  pingJellyfin,
} from '../util/jellyfin.js';
import { pingAudioMuse } from '../util/audiomuse.js';
import { getUserInfo, tokenMiddleware, getUserData, saveUserData } from '../util/user.js';
import { generateSetId, generateSetName } from '../util/helpers.js';

const router = Router();

// Non-user routes
router.get('/', (_, res) => res.send('OK'));

// Dependency health check: /api/health -> { jellyfin, audiomuse }
router.get('/health', async (_, res) => {
  const [jellyfin, audiomuse] = await Promise.all([pingJellyfin(), pingAudioMuse()]);
  const ok = jellyfin.authenticated && audiomuse.reachable;
  return res.status(ok ? 200 : 503).send({ ok, jellyfin, audiomuse });
});

router.get('/search', async (req, res) => {
  const query = req.query.q;
  try {
    const albums = await searchAlbums(query);
    return res.send(albums);
  } catch (e) {
    return res.status(502).send(e.message);
  }
});

// Whole library, for the collection import screen.
router.get('/all-albums', async (_, res) => {
  try {
    return res.send(await listAllAlbums());
  } catch (e) {
    return res.status(502).send(e.message);
  }
});

router.get('/album-by-id/:id', tokenMiddleware, async (req, res) => {
  const id = req.params.id;
  try {
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    const data = await specificAlbumGet(id);
    const collectionItem = userData.collection.find((x) => x.id == id);
    return res.send({ ...data, tags: collectionItem?.tags ?? [] });
  } catch (e) {
    const notFound = /not found/i.test(e.message || '');
    return res.status(notFound ? 404 : 502).send(e.message);
  }
});

router.get('/album-search', async (req, res) => {
  const { artist, album } = req.query;
  try {
    const data = await searchArtistAlbum(artist, album);
    if (!data) return res.status(404).send('Album not found');
    return res.send(await specificAlbumGet(data.id));
  } catch (e) {
    return res.status(502).send(e.message);
  }
});

// Stream a Jellyfin album cover (keeps the API token server-side)
router.get('/image/:id', async (req, res) => {
  try {
    const upstream = await fetchImage(req.params.id, Number(req.query.size) || 300);
    if (upstream.status >= 400) return res.status(upstream.status).end();
    res.set('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    return upstream.data.pipe(res);
  } catch (e) {
    return res.status(404).end();
  }
});

// Stream a Jellyfin audio track, forwarding Range requests so the waveform
// player can seek/scrub.
router.get('/stream/:id', async (req, res) => {
  try {
    const upstream = await fetchAudio(req.params.id, req.headers.range);
    if (upstream.status >= 400) return res.status(upstream.status).end();
    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      if (upstream.headers[h]) res.set(h, upstream.headers[h]);
    }
    return upstream.data.pipe(res);
  } catch (e) {
    return res.status(404).end();
  }
});

// User specific routes
const upload = multer({ storage: multer.memoryStorage() }).single('csv');
router.post('/csv', tokenMiddleware, upload, async (req, res) => {
  try {
    const lines = await neatCsv(req.file.buffer);
    if (!lines.length) throw new Error("Can't parse file as CSV");

    const results = await Promise.all(
      lines.map((line) => {
        const artist = line.Artist;
        const album = line.Title;
        return searchArtistAlbum(artist, album).catch(
          () => `Album not found: ${artist} - ${album}`
        );
      })
    );
    return res.send(results);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

// Collection
router.get('/user', tokenMiddleware, async (req, res) => {
  try {
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);

    if (req.query.c === 'true') {
      userData.collection = await hydrateCollection(userData.collection);
    }

    return res.send(userData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

router.post('/user', tokenMiddleware, async (req, res) => {
  try {
    const userInfo = await getUserInfo(req.token);
    await saveUserData(userInfo.sub, req.body);
    const newData = await getUserData(userInfo.sub);
    return res.send(newData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

// Bulk add for the import screen: body { ids: string[] }.
router.post('/user/collection/add', tokenMiddleware, async (req, res) => {
  try {
    const ids = req.body?.ids ?? [];
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);

    for (const id of ids) {
      if (!userData.collection.find((x) => x.id == id)) {
        userData.collection.push({ id, tags: [] });
      }
    }

    await saveUserData(userInfo.sub, userData);
    return res.send(userData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

router.put('/user/collection/add/:id', tokenMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);

    if (req.query.c === 'true') {
      userData.collection = await hydrateCollection(userData.collection);
    }

    const exists = userData.collection.find((x) => x.id == id);
    if (exists) {
      return res.send(userData);
    }
    userData.collection.push({ id, tags: [] });
    await saveUserData(userInfo.sub, userData);
    return res.send(userData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

router.put('/user/collection/remove/:id', tokenMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);

    if (req.query.c === 'true') {
      userData.collection = await hydrateCollection(userData.collection);
    }

    const idx = userData.collection.findIndex((x) => x.id == id);
    // Keep the original (buggy but harmless) guard shape; only splice valid ids.
    if (!(idx >= 0)) {
      return res.send(userData);
    }
    userData.collection.splice(idx, 1);
    await saveUserData(userInfo.sub, userData);
    return res.send(userData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

router.post('/user/set/new', tokenMiddleware, async (req, res) => {
  try {
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    const newSet = {
      id: generateSetId(),
      created: Date.now(),
      name: generateSetName(!!req?.body?.tracks),
      tracks: req?.body?.tracks || [],
    };
    userData.sets.push(newSet);
    await saveUserData(userInfo.sub, userData);
    return res.send(userData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

// Hydrate a dehydrated collection ({id, tags}) into full album objects. Any id
// that no longer resolves is skipped rather than aborting the whole request.
// Concurrency is capped: firing hundreds of Jellyfin requests at once gets the
// TLS connections reset, which silently dropped albums.
async function hydrateCollection(collection) {
  const hydrated = await mapLimit(collection, 8, async (item) => {
    try {
      const album = await specificAlbumGet(item.id);
      return { ...album, tags: item.tags || [] };
    } catch (e) {
      return null;
    }
  });
  return hydrated.filter(Boolean);
}

// Run `fn` over `items` with at most `limit` in flight at once.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export default router;
