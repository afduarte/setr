import axios from 'axios';
import path from 'path';
import * as url from 'url';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import Logger from './logger.js';

const API = (process.env.AUDIOMUSE_URL || 'https://audiomuse.server.afduarte.co.uk').replace(/\/$/, '');
const API_KEY = process.env.AUDIOMUSE_API_KEY || '';
if (!API_KEY) Logger.debug('AUDIOMUSE_API_KEY is not set; AudioMuse requests will be rejected.');

// How long a persisted library snapshot stays fresh before we re-sync
const CACHE_TTL_MS = Number(process.env.AUDIOMUSE_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const PAGE_LIMIT = 500;
const MAX_PAGES = 200; // safety valve

const __dirname = url.fileURLToPath(new URL('..', import.meta.url));
const CACHE_DIR = process.env.STORAGE || path.join(__dirname, 'data', 'audiomuse');
const CACHE_FILE = path.join(CACHE_DIR, 'library.json');

const headers = { Authorization: `Bearer ${API_KEY}` };

// Pitch-class lookup. AudioMuse returns note names with sharps ('C#', 'A#'), but
// we accept flats/unicode variants defensively.
const NOTE_TO_PITCH = {
  C: 0, 'C#': 1, Db: 1, 'D♭': 1, D: 2, 'D#': 3, Eb: 3, 'E♭': 3, E: 4,
  F: 5, 'F#': 6, Gb: 6, 'G♭': 6, G: 7, 'G#': 8, Ab: 8, 'A♭': 8, A: 9,
  'A#': 10, Bb: 10, 'B♭': 10, B: 11,
};

function noteToPitch(note) {
  if (!note || typeof note !== 'string') return null;
  const cleaned = note.trim().replace('♯', '#');
  if (cleaned in NOTE_TO_PITCH) return NOTE_TO_PITCH[cleaned];
  // Capitalise first letter, e.g. 'c#' -> 'C#'
  const normalised = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return normalised in NOTE_TO_PITCH ? NOTE_TO_PITCH[normalised] : null;
}

function scaleToMode(scale) {
  return /maj/i.test(scale || '') ? 1 : 0;
}

// AudioMuse stores moods as a flat "name:value,name:value" string
function parseOtherFeatures(raw) {
  const out = {};
  if (!raw) return out;
  for (const part of String(raw).split(',')) {
    const [k, v] = part.split(':');
    if (!k) continue;
    const num = Number(v);
    out[k.trim().toLowerCase()] = Number.isFinite(num) ? num : v;
  }
  return out;
}

export function toAudioFeatures(entry, durationMs) {
  if (!entry) return undefined;
  const moods = parseOtherFeatures(entry.other_features);
  const pitch = noteToPitch(entry.key);

  const features = {
    tempo: Number(entry.tempo) || 0,
    duration_ms: durationMs ?? entry.duration ?? 0,
  };
  // Only expose key/mode together when the note was understood; the frontend
  // crashes on a partially populated key.
  if (pitch !== null) {
    features.key = pitch;
    features.mode = scaleToMode(entry.scale);
  }
  if (Number.isFinite(entry.energy)) features.energy = entry.energy;
  if (Number.isFinite(moods.danceable)) features.danceability = moods.danceable;
  if (Number.isFinite(moods.happy)) features.valence = moods.happy;
  return features;
}

let memMap = null;
let memLoadedAt = 0;
let loading = null;

function fileIsFresh(mtimeMs) {
  return Date.now() - mtimeMs < CACHE_TTL_MS;
}

async function readDiskCache() {
  try {
    const st = await stat(CACHE_FILE);
    if (!fileIsFresh(st.mtimeMs)) return null;
    const raw = JSON.parse(await readFile(CACHE_FILE, 'utf-8'));
    return new Map(Object.entries(raw));
  } catch {
    return null;
  }
}

async function writeDiskCache(map) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(map)));
  } catch (e) {
    Logger.debug(`Could not persist AudioMuse cache: ${e.message}`);
  }
}

async function fetchFullSync() {
  const map = new Map();
  let page = 1;
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data } = await axios.get(`${API}/api/sync`, {
      headers,
      params: { include_embeddings: false, limit: PAGE_LIMIT, page },
      timeout: 60000,
    });
    for (const t of data.tracks ?? []) map.set(t.id, t);
    if (!data.has_more) break;
    page = data.next_page ?? page + 1;
  }
  Logger.debug(`AudioMuse sync loaded ${map.size} tracks`);
  return map;
}

async function fetchSyncByIds(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += PAGE_LIMIT) {
    const chunk = ids.slice(i, i + PAGE_LIMIT);
    try {
      const { data } = await axios.get(`${API}/api/sync`, {
        headers,
        params: { include_embeddings: false, ids: chunk.join(',') },
        timeout: 30000,
      });
      for (const t of data.tracks ?? []) out.set(t.id, t);
    } catch (e) {
      Logger.debug(`AudioMuse id lookup failed: ${e.message}`);
    }
  }
  return out;
}

// Loads (and caches) the whole analysed library. On any failure we fall back to
// an empty map so the app keeps working with tracks showing "---".
export async function loadAnalysisMap(force = false) {
  if (!force && memMap && Date.now() - memLoadedAt < CACHE_TTL_MS) return memMap;
  if (loading) return loading;

  loading = (async () => {
    if (!force) {
      const disk = await readDiskCache();
      if (disk) {
        memMap = disk;
        memLoadedAt = Date.now();
        return memMap;
      }
    }
    try {
      const map = await fetchFullSync();
      if (map.size > 0) {
        memMap = map;
        memLoadedAt = Date.now();
        await writeDiskCache(map);
        return map;
      }
    } catch (e) {
      Logger.error(`Failed to load AudioMuse library: ${e.message}`);
    }
    // Keep any previous in-memory copy rather than wiping it
    if (!memMap) memMap = new Map();
    memLoadedAt = Date.now();
    return memMap;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

// Returns a Map<trackId, audioFeatures> for the requested ids, using the cached
// library and one batched AudioMuse call for anything not yet in it.
export async function getAudioFeaturesMap(ids, durationById = {}) {
  const wanted = [...new Set(ids.filter(Boolean))];
  const result = new Map();
  if (!wanted.length) return result;

  const map = await loadAnalysisMap();
  const missing = [];
  for (const id of wanted) {
    if (map.has(id)) result.set(id, toAudioFeatures(map.get(id), durationById[id]));
    else missing.push(id);
  }

  if (missing.length) {
    const extra = await fetchSyncByIds(missing);
    for (const [id, entry] of extra) {
      map.set(id, entry);
      result.set(id, toAudioFeatures(entry, durationById[id]));
    }
  }
  return result;
}

export async function getAudioFeatures(id, durationMs) {
  const map = await getAudioFeaturesMap([id], { [id]: durationMs });
  return map.get(id);
}

// Health probe used by GET /api/health.
export async function pingAudioMuse() {
  try {
    const { data } = await axios.get(`${API}/api/version`, { headers, timeout: 10000 });
    return { reachable: true, version: data?.app_version ?? null, error: null };
  } catch (e) {
    return {
      reachable: false,
      version: null,
      error: e.response?.status === 401 ? 'AudioMuse authentication failed (401). Check AUDIOMUSE_API_KEY.' : e.message,
    };
  }
}

export default { loadAnalysisMap, getAudioFeaturesMap, getAudioFeatures, toAudioFeatures, pingAudioMuse };
