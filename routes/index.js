import { Router } from 'express';
import multer from 'multer';
import neatCsv from 'neat-csv';
import {specificAlbumGet, generalSearch, getToken, searchArtistAlbum, } from '../util/spotify.js'
import { downloadYoutube, searchYoutube } from '../util/youtube.js';
import { getUserInfo, tokenMiddleware, getUserData } from '../util/user.js';



const router = Router();
// Non-user routes
router.get('/', (_, res) => res.send("OK"));

router.get('/token', async (_, res) => res.send(await getToken()));

router.get('/search', async (req, res) => {
  const token = await getToken();
  const query = req.query.q
  try {
    let albumData = await generalSearch(token, query)
    albumData = albumData.map(a => ({...a, available_markets:[]}))
    return res.send(albumData);
  } catch (e) {
    return res.status(404).send(e.message);
  }
});

router.get('/album-by-id/:id', async (req, res) => {
  const token = await getToken();
  const id = req.params.id
  try {
    const data = await specificAlbumGet(token, id);
    return res.send(data);
  } catch (e) {
    return res.status(404).send(e.message);
  }
})

router.get('/album-search', async (req, res) => {
  const token = await getToken()
  const artist = req.query.artist;
  const album = req.query.album;
  try{
    return res.send(await searchArtistAlbum(token, artist, album));
  }catch(e){
    return res.status(404).send(e.message);
  }
});

router.get('/transitioner-search', async (req, res) => {
  const artist = req.query.artist;
  const track = req.query.track;
  try{
    return res.send(await searchYoutube(`${artist} - ${track}`));
  }catch(e){
    console.log(e)
    return res.status(404).send(e.message);
  }
});

router.get('/transitioner-dl', async (req, res) => {
  const id = req.query.id;
  try{
    const stream = await downloadYoutube(id)
    stream.pipe(res)
  }catch(e){
    console.log(e)
    return res.status(404).send(e.message);
  }
});

// User specific routes
const upload = multer({storage: multer.memoryStorage()}).single("csv");
router.post('/csv', upload, async (req, res) => {
  try{
  const lines = await neatCsv(req.file.buffer);

  if(!lines.length) throw new Error("Can't parse file as CSV")

  const token = await getToken();
  const results = await Promise.all(lines.map(line => {
    
    const artist = line.Artist;
    const album = line.Title;
    return searchArtistAlbum(token, artist, album).catch(e => `Album not found: ${artist} - ${album}`);
  }));
  return res.send(results)
}catch(e){
  return res.status(400).send(e.message);
}
});

// Collection
router.get('/user', tokenMiddleware, async (req, res) => {
  try{
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    return res.send(userData);
  }catch(e){
    return res.status(400).send(e.message);
  }
})

router.put('/user/collection/add/:id', tokenMiddleware, async (req, res) => {
  try{
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    return res.send(userData);
  }catch(e){
    return res.status(400).send(e.message);
  }
})

export default router;
