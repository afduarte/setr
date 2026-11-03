# AGENTS.md

DJ set-planner. Music comes from **Jellyfin**; BPM/key analysis comes from
**AudioMuse-AI**. Auth is Auth0. pnpm workspace with `backend` (Express, ESM) and
`frontend` (Vue 3 + Pinia + Pug + Vite).

## Architecture

- **Join key:** an AudioMuse track `id` is the same as the Jellyfin item id.
- **Backend owns all tokens** and proxies media: `GET /api/image/:id` (cover art)
  and `GET /api/stream/:id` (audio, Range-aware). Both are intentionally public
  because `<img>`/wavesurfer can't send the Auth0 bearer.
- **Album hydration** (`util/jellyfin.js`): fetch Jellyfin album + its audio
  items, normalise into the frontend's album/track shape, then enrich each track
  from AudioMuse. Raw album is disk-cached (`backend/data/albums/jf-<id>`);
  analysis is applied on every read so re-analysis shows up without cache clears.
- **Analysis** (`util/audiomuse.js`): loads the whole library once via
  `/api/sync`, caches to `backend/data/audiomuse/library.json` (TTL 6h), and
  batch-fetches new ids via `?ids=`. Maps `key` note → pitch class 0-11 and
  `scale` → mode (major=1, minor=0).
- **User data** on disk: `backend/data/users/<auth0-sub>` (collection + sets).
  Collections store `{id, tags}`; sets store `{id, note, adjustment}`.

## Commands

```
pnpm install                 # root (workspace)
cd backend  && pnpm dev      # port 3000, loads backend/.env
cd frontend && pnpm dev      # port 5173, proxies /api -> :3000
cd frontend && pnpm run build-only   # vite build (use this, not `pnpm build`)
curl localhost:3000/api/health        # dependency check
```

`pnpm run build` also runs `type-check`, which currently fails on pre-existing
`vue-slider-component` library typings (not this code). `build-only` is clean.

## Config

`backend/.env` (gitignored; see `.env.example`): `JELLYFIN_URL`,
`JELLYFIN_API_KEY`, `AUDIOMUSE_URL`, `AUDIOMUSE_API_KEY`. Optional:
`JELLYFIN_USER_ID` (defaults to an admin), `AUDIOMUSE_CACHE_TTL_MS`.

## API (`/api`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ok, jellyfin, audiomuse}` |
| GET | `/search?q=` | album summaries |
| GET | `/all-albums` | whole library (import screen) |
| GET | `/album-search?artist=&album=` | |
| GET | `/album-by-id/:id` | auth; hydrated album |
| GET | `/image/:id`, `/stream/:id` | public media proxies |
| GET/POST | `/user` | auth; `?c=true` hydrates collection |
| POST | `/user/collection/add` | auth; bulk `{ids}` |
| PUT | `/user/collection/{add,remove}/:id` | auth |
| POST | `/user/set/new` | auth |

## Gotchas / conventions

- `AudioFeature.key` and `.mode` are **optional and only set together**; other
  feature fields are optional too. Only expose `key` when the note parses,
  otherwise the frontend crashes.
- Jellyfin album search ignores artist names, so `searchAlbums` merges an
  album-name search with an album-artist search.
- Album summaries report `total_tracks: 0` (Jellyfin's `/Items` list endpoint
  does not populate `ChildCount`; only the single-item `/Items/{id}` does, and
  counting via Audio items means scanning the whole library, which is far too
  slow to do per request).
- Cache keys are namespaced `jf-<id>`; secrets only ever live in `.env`.
- No Spotify/YouTube code or dependencies.

## Known issues

- **Jellyfin API keys can be invalidated by a server upgrade.** Symptom: search
  returns 502 / health shows `authenticated: false` with 401. Fix: create a new
  key and restart the backend (env is read at startup).
- Full `type-check` fails on the third-party slider component (pre-existing).
- AudioMuse tempo is librosa-derived and sometimes quantised/imprecise; keys come
  back as note+scale only. Only analysed tracks have features (others show `---`).
- Library metadata is messy: some "albums" are huge multi-artist compilations.
- Live view is minimal (basic BPM/key suggestions).
