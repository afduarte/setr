# Codename Playlistify

App for DJ set creation. Music metadata and playback come from **Jellyfin**;
BPM/key analysis comes from **AudioMuse-AI**.

## How it fits together

- **Jellyfin** provides albums, tracks, artwork and audio streams.
- **AudioMuse-AI** provides the sonic analysis (tempo/BPM, key + scale, energy and
  mood). Its track `id` is the same as the Jellyfin item id, so the two are
  joined by id. BPM/key are **not** exposed through Jellyfin (not even by the
  AudioMuse Jellyfin plugin), so the backend talks to AudioMuse directly.
- The backend keeps the Jellyfin API key and AudioMuse bearer token server-side
  and proxies artwork (`/api/image/:id`) and audio (`/api/stream/:id`).
- Auth is still Auth0; user collections/sets are stored on disk under
  `backend/data/users`.

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill it in:

```
JELLYFIN_URL=https://your-jellyfin/jellyfin
JELLYFIN_API_KEY=...
AUDIOMUSE_URL=https://your-audiomuse
AUDIOMUSE_API_KEY=...
AUTH0_DOMAIN=your-tenant.eu.auth0.com
```

The frontend reads its Auth0 config from `frontend/.env` (see
`frontend/.env.example`):

```
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=...
```

`JELLYFIN_USER_ID` is optional (an admin user is picked automatically).
`AUDIOMUSE_CACHE_TTL_MS` controls how long the cached analysis snapshot is
reused (default 6 hours).

## Setup

```
# Install workspace packages (pnpm workspace)
pnpm install
```

## To run backend

```
cd backend
pnpm dev
```

## To run frontend

```
cd frontend
pnpm dev
```

## To run frontend as host

```
cd frontend
pnpm dev -- --host
```

## Notes

- The full AudioMuse analysis library is fetched once via `/api/sync` and cached
  in `backend/data/audiomuse/library.json`. Anything analysed after the snapshot
  is fetched on demand by id.
- Legacy data is kept locally under `backend/data/_legacy-archive/` (gitignored).
