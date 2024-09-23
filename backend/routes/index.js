import { Router } from 'express';
import multer from 'multer';
import neatCsv from 'neat-csv';
import {specificAlbumGet, generalSearch, getToken, searchArtistAlbum, getCollection } from '../util/spotify.js'
import { downloadYoutube, searchYoutube } from '../util/youtube.js';
import { getUserInfo, tokenMiddleware, getUserData, saveUserData } from '../util/user.js';
import Logger from '../util/logger.js';
import { generateSetId, generateSetName } from '../util/helpers.js';



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
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    const data = await specificAlbumGet(token, id);
    const collectionItem = userData.collection.find(x => x.id == id)
    return res.send({...data, tags: (collectionItem?.tags ?? [])});
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
router.post('/csv', tokenMiddleware, upload, async (req, res) => {
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
  try {
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);

    if (req.query.c === 'true') {
      const token = await getToken();

      // Use the getCollection method to hydrate the collection
      const hydratedCollection = await getCollection(token, userData.collection);

      // Replace the collection with the hydrated collection
      userData.collection = hydratedCollection;
    }

    return res.send(userData);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

router.post('/user', tokenMiddleware, async (req, res) => {
  try{
    const userInfo = await getUserInfo(req.token);
    await saveUserData(userInfo.sub, req.body);
    const newData = await getUserData(userInfo.sub);
    return res.send(newData);
  }catch(e){
    return res.status(400).send(e.message);
  }
})

router.put('/user/collection/add/:id', tokenMiddleware, async (req, res) => {
  try{
    const id = req.params.id;
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    if (req.query.c === 'true') {
      const token = await getToken();

      // Use the getCollection method to hydrate the collection
      const hydratedCollection = await getCollection(token, userData.collection);

      // Replace the collection with the hydrated collection
      userData.collection = hydratedCollection;
    }
    // Make sure it's not in the collection already. If it is, return the collection
    const exists = userData.collection.find(x => x.id == id)
    if(exists){
      return res.send(userData)
    }
    // Otherwise store the id in the collection and save userData
    userData.collection.push({ id, tags:[] })
    await saveUserData(userInfo.sub, userData)
    // return the resulting userData object with the new item
    return res.send(userData);
  }catch(e){
    return res.status(400).send(e.message);
  }
})

router.put('/user/collection/remove/:id', tokenMiddleware, async (req, res) => {
  try{
    const id = req.params.id;
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    if (req.query.c === 'true') {
      const token = await getToken();

      // Use the getCollection method to hydrate the collection
      const hydratedCollection = await getCollection(token, userData.collection);

      // Replace the collection with the hydrated collection
      userData.collection = hydratedCollection;
    }
    // Make sure it's in the collection already. If it's not, return the collection as is
    const idx = userData.collection.findIndex(x => x.id == id)
    if(!idx < 0){
      return res.send(userData)
    }
    // Otherwise remove the id in the collection and save userData
    userData.collection.splice(idx, 1)
    await saveUserData(userInfo.sub, userData)
    // return the resulting userData object without the item
    return res.send(userData);
  }catch(e){
    return res.status(400).send(e.message);
  }
})

router.post('/user/set/new', tokenMiddleware, async (req, res) => {
  try{
    const userInfo = await getUserInfo(req.token);
    const userData = await getUserData(userInfo.sub);
    // generate the new set with placeholder data and created = now()
    const newSet = {
      id: generateSetId(),
      created: Date.now(),
      name: generateSetName(!!req?.body?.tracks),
      tracks: req?.body?.tracks|| []
    }
    userData.sets.push(newSet)
    await saveUserData(userInfo.sub, userData)
    // return the resulting userData object with the new set
    return res.send(userData);
  }catch(e){
    return res.status(400).send(e.message);
  }
})

export default router;
