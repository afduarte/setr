import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import { api, getSpotifyIDFromURL } from "@/utils";

export function getSortingString(a: EnhancedAlbum): string {
  const artist = a.artists
    .map((a) =>
      a.name
        .replace(/^[Tt]he\s*/, "")
        .replace(/[Vv]arious\s*[Aa]rtists\s*/, "")
        .replace(/^\d/, "#")
    )
    .join();
  const date = a.release_date.split("-").shift();
  const title = a.name.replace(/^\d/, "#");
  return `${artist || title}${date}${title}`;
}

export function getFormattedTrackName(t: TrackData) {
  const artist = t.artists.map((a) => a.name).join();
  const title = t.name;
  return `${artist} - ${title}`;
}

export interface Image {
  height: number;
  width: number;
  url: string;
}

export interface AlbumData {
  album_type: "album";
  artists: ArtistData[];
  available_markets: string[];
  external_urls: ExtUrls;
  href: string;
  id: string;
  name: string;
  release_date: string;
  release_date_precision: string;
  popularity: number;
  type: string;
  uri: string;
  images: Image[];
  total_tracks: number;
  tracks: TrackData[];
}

type ExtUrls = { [name: string]: string };
export interface ArtistData {
  external_urls: ExtUrls;
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
}

export interface TrackData {
  artists: ArtistData[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_urls: ExtUrls;
  href: string;
  id: string;
  is_local: boolean;
  name: string;
  preview_url: string;
  track_number: number;
  type: string;
  uri: string;
  audioFeatures?: AudioFeature;
}

export interface AudioFeature {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  type: string;
  id: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  duration_ms: number;
  time_signature: number;
}

export type TrackClickEvent = {
  track: TrackData;
  index: number;
};

export type EnhancedTrack = TrackData & {
  adjustment: number;
  note: string;
};

export type TrackMeta = {
  id: string;
  adjustment: number;
  note: string;
};

export type AlbumMeta = {
  id: string;
  tags: string[];
};

export type EnhancedAlbum = AlbumData & AlbumMeta;

export type Set = {
  id: string;
  name: string;
  created: number;
  tracks: TrackMeta[];
};

export type EnhancedSet = Set & { tracks: EnhancedTrack[] };

export type UserData = {
  collection: AlbumMeta[];
  sets: Set[];
};

export const useStore = defineStore("store", {
  state() {
    return {
      userData: {} as UserData,
      collection: [] as AlbumMeta[],
      albums: useStorage<{ [id: string]: AlbumData }>("albums", {}),
      trackToAlbum: {} as { [track: string]: string },
      albumTags: {} as { [tag: string]: boolean },
      set: {} as EnhancedSet,
      searchResults: [] as AlbumData[],
    };
  },
  actions: {
    loadSet(s: Set) {
      const tracks = s.tracks
        .map((t) => {
          if (!this.trackToAlbum[t.id]) return;
          const album = this.albums[this.trackToAlbum[t.id]];
          if (!album) return;
          const track = album.tracks.find((x) => x.id == t.id);
          if (!track) return;
          return {
            ...track,
            adjustment: t.adjustment,
            note: t.note,
          } as EnhancedTrack;
        })
        .filter((x) => !!x) as EnhancedTrack[];

      this.set = { ...s, tracks };
    },
    async uploadCSV(f: File) {
      const formData = new FormData();
      formData.append("csv", f);
      const { data } = await api.post<{ [id: string]: AlbumData }>(
        `/csv`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      this.albums = data;
    },
    async getUserData() {
      const { data } = await api.get(`/user`);
      this.userData = data;
      this.downloadCollection();
    },
    async saveUserData() {
      await api.post(`/user`, this.userData);
      await this.getUserData();
    },
    async downloadCollection() {
      console.log('downloading collection')
      const promises = this.userData.collection.map((a) => {
        console.log(`checking album (${a.id})`, a)
        if(!this.albums) throw new Error('albums not initialised')
        const album = this.albums[a.id];
        if (!album) {
          console.log('')
          a.tags.forEach((t) => (this.albumTags[t] = true));
          return this.addAlbum(a.id);
        } else {
          album.tracks.forEach((t) => (this.trackToAlbum[t.id] = album.id));
          return Promise.resolve();
        }
      });
      await Promise.all(promises);
    },
    async search(q: string) {
      if (q.includes("spotify")) {
        const id = getSpotifyIDFromURL(q);
        const { data } = await api.get<AlbumData>(`/album-by-id/${id}`);
        this.searchResults = [data];
      } else {
        const { data } = await api.get<AlbumData[]>("/search", {
          params: { q },
        });
        this.searchResults = data;
      }
    },
    clearSearch() {
      this.searchResults = [];
    },
    async addSet() {
      const { data } = await api.post<UserData>(`/user/set/new`);
      this.userData = data;
    },
    async addAlbum(id: string) {
      const { data } = await api.get<AlbumData>(`/album-by-id/${id}`);
      this.albums[data.id] = data;
      data.tracks.forEach((t) => (this.trackToAlbum[t.id] = data.id));
    },
    async addToCollection(id: string) {
      const { data } = await api.put<UserData>(`/user/collection/add/${id}`);
      this.userData = data;
      this.downloadCollection();
    },
    async removeFromCollection(id: string) {
      const r = await api.put<UserData>(`/user/collection/remove/${id}`);
      this.userData = r.data;
      this.downloadCollection();
    },
    async addTrack(t: TrackData) {
      // Turn the track into an enhanced track so we persist notes and adjustment data
      this.set.tracks.push({ ...t, note: "", adjustment: 0 });
      this.updateMetaSet();
    },
    async removeTrack(t: TrackClickEvent) {
      this.set.tracks.splice(t.index, 1);
      this.updateMetaSet();
    },
    async updateMetaSet() {
      const idx = this.userData.sets.findIndex((x) => x.id == this.set.id);
      if (idx < 0) return;
      this.userData.sets[idx].tracks = this.set.tracks.map((et) => ({
        id: et.id,
        note: et.note,
        adjustment: et.adjustment,
      }));
      this.saveUserData();
    },
  },
  getters: {
    getAlbumIdForTrack(state) {
      return (trackId: string) => state.trackToAlbum[trackId];
    },
    allTracks(state) {
      return Object.values(state.albums.value)
        .flatMap((a) => a.tracks)
        .reduce((acc, next) => {
          acc[next.id] = next;
          return acc;
        }, {} as { [id: string]: TrackData });
    },
  },
});
