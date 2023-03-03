import { Router } from 'express';
import axios from 'axios';
import multer from 'multer';
import neatCsv from 'neat-csv';

const client_id = 'd185711092bf486090bc56a9a58dce0a';
const client_secret = '959e05d7dd414f2e8929b4d11ef1446e';


const router = Router();
/* GET home page. */
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

const API = 'https://api.spotify.com/v1'

async function specificAlbumGet(token, id){
  let {albumData, tracks} = await getAlbumDataById(token, id);
  if(!albumData) throw new Error("Album not found");
  // cleanup available_markets field
  albumData = {...albumData, available_markets:[]}
  if(!tracks) throw new Error("Tracks for album not found");
  // cleanup available_markets field
  tracks = tracks.map(t => ({...t, available_markets:[]}))
  const trackIds = tracks.map(t => t.id).join(",");
  const audioFeatures = await getAudioFeatures(token, trackIds);
  if(!audioFeatures) throw new Error("Audio features for album not found")
  tracks = tracks.map(t => {
    const features = audioFeatures.find(x => x.id === t.id)
    return {...t, audioFeatures: features}
  })
  return {
    ...albumData,
    tracks,
  };
  
}

async function searchArtistAlbum(token, artist, album){
  let albumData = await getAlbumData(token, artist, album);
  if(!albumData) throw new Error("Album not found");
  // cleanup available_markets field
  albumData = {...albumData, available_markets:[]}
  return  await specificAlbumGet(token, albumData.id);
}

async function getAlbumDataById(token, id){
  const { data } = await axios.get(`${API}/albums/${id}`, { 
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const {tracks, ...rest} = data
  return {albumData: rest, tracks: tracks.items};
}

async function generalSearch(token, query){
  const { data } = await axios.get(`${API}/search`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { q: query, type: 'album' }
  })
  if(!data.albums || !data.albums.items || !data.albums.items.length) return null;
  return data.albums.items;
}

async function getAudioFeatures(token, ids){
  const { data } = await axios.get(`${API}/audio-features`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { ids }
  })
  if(!data || !data.audio_features || !data.audio_features.length) return null;
  return data.audio_features;
}

async function getTracks(token, albumId){
  const { data } = await axios.get(`${API}/albums/${albumId}/tracks`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { limit: 50 }
  })
  if(!data || !data.items || !data.items.length) return null;
  return data.items;
}

async function getAlbumData(token, artist, album){
  const { data } = await axios.get(`${API}/search`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { q: `artist:${artist} album:${album}`, type: 'album' }
  })
  if(!data.albums || !data.albums.items || !data.albums.items.length) return null;
  return data.albums.items[0];
}

async function getToken(){
  const { data } = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
  headers: { 'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')) }
});
return data.access_token;
}

export default router;
