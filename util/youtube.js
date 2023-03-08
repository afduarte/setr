import axios from 'axios'
import ytdl from 'ytdl-core'

const key = 'AIzaSyBvrI3raFAuTPDhaS3z_k0ao8zubeerJxw';
const API = 'https://youtube.googleapis.com/youtube/v3';


export async function searchYoutube(q){
  const { data } = await axios.get(`${API}/search`, {
  params: {
    part: 'snippet',
    maxResults: 10,
    type: 'video',
    key,
    q
  }
});
return data.items.map(v => ({
  id: v.id.videoId,
  title: v.snippet.title,
  thumbnail: v.snippet.thumbnails ? v.snippet.thumbnails.default.url : undefined,
})).sort((a,b) =>{
  const aOfficial = a.title.toLowerCase().includes('official audio')
  const bOfficial = b.title.toLowerCase().includes('official audio')
  if(aOfficial && !bOfficial) return -1
  if(bOfficial && !aOfficial) return 1
  return 0;
});
}

export async function downloadYoutube(vId){
  const info = await ytdl.getInfo(vId);
  const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
  const best = ytdl.chooseFormat(audioFormats, 'highestaudio')
  return ytdl(vId, {format:best})
}