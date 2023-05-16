import axios from 'axios';
import { getFromCache, storeInCache} from './cache.js'

const API = 'https://api.spotify.com/v1'

const client_id = 'd185711092bf486090bc56a9a58dce0a';
const client_secret = '959e05d7dd414f2e8929b4d11ef1446e';

export async function specificAlbumGet(token, id){
  const cached = await getFromCache(id);
  if(cached) return cached;
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
  const album = {
    ...albumData,
    tracks,
  };
  storeInCache(id, album)
  return album;
}

export async function searchArtistAlbum(token, artist, album){
  let albumData = await getAlbumData(token, artist, album);
  if(!albumData) throw new Error("Album not found");
  // cleanup available_markets field
  albumData = {...albumData, available_markets:[]}
  return  await specificAlbumGet(token, albumData.id);
}

export async function getAlbumDataById(token, id){
  const { data } = await axios.get(`${API}/albums/${id}`, { 
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const {tracks, ...rest} = data
  return {albumData: rest, tracks: tracks.items};
}

export async function generalSearch(token, query){
  const { data } = await axios.get(`${API}/search`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { q: query, type: 'album' }
  })
  if(!data.albums || !data.albums.items || !data.albums.items.length) return null;
  return data.albums.items;
}

export async function getAudioFeatures(token, ids){
  const { data } = await axios.get(`${API}/audio-features`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { ids }
  })
  if(!data || !data.audio_features || !data.audio_features.length) return null;
  return data.audio_features;
}

export async function getTracks(token, albumId){
  const { data } = await axios.get(`${API}/albums/${albumId}/tracks`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { limit: 50 }
  })
  if(!data || !data.items || !data.items.length) return null;
  return data.items;
}

export async function getAlbumData(token, artist, album){
  const { data } = await axios.get(`${API}/search`, { 
    headers: { 'Authorization': `Bearer ${token}` },
    params: { q: `artist:${artist} album:${album}`, type: 'album' }
  })
  if(!data.albums || !data.albums.items || !data.albums.items.length) return null;
  return data.albums.items[0];
}

export async function getToken(){
  const { data } = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
  headers: { 'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')) }
  });
  return data.access_token;
}