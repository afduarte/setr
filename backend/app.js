import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { fileURLToPath } from 'url';
import indexRouter from './routes/index.js';
import Logger from './util/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTML_DIR =process.env.HTML_DIR || '../frontend/dist'
const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, HTML_DIR)));

app.use('/api', indexRouter);

// Always serve the index.html file for any unknown routes
app.get('*', (req, res) => {
  return res.sendFile(path.join(__dirname, `${HTML_DIR}/index.html`));
});

export default app;
