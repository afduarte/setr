// This file runs before every test file's imports, so env vars must be set
// here: util/cache.js, util/user.js and util/audiomuse.js capture
// process.env.STORAGE at module load (and process.exit() on a bad dir), and
// the API URLs/keys are baked into module-level constants too.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storageDir = path.resolve(__dirname, './.tmp/storage');
fs.mkdirSync(storageDir, { recursive: true });

process.env.STORAGE = storageDir;
process.env.NODE_ENV = 'test';
process.env.HTML_DIR = path.resolve(__dirname, './.tmp/static');

process.env.JELLYFIN_URL = process.env.JELLYFIN_URL || 'http://jellyfin.test';
process.env.JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || 'test-jf-key';
process.env.AUDIOMUSE_URL = process.env.AUDIOMUSE_URL || 'http://audiomuse.test';
process.env.AUDIOMUSE_API_KEY = process.env.AUDIOMUSE_API_KEY || 'test-am-key';
process.env.JELLYFIN_USER_ID = 'test-user-id';
process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'auth0.test';

// dotenv (loaded by app.js) does not override already-set vars, so these
// test values always win over a real backend/.env.
