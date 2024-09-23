import { defineStore } from "pinia";
import { api, getSpotifyIDFromURL } from "@/utils";

export function getSortingString(a: EnhancedAlbum): string {
  if(!a.artists) return a.name.replace(/^\d/, "#");
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

export type EnhancedAlbum = AlbumData & {
  tags: string[];
};

export type Set = {
  id: string;
  name: string;
  created: number;
  tracks: TrackMeta[];
};

export type EnhancedSet = Set & { tracks: EnhancedTrack[] };

export type UserData = {
  collection: EnhancedAlbum[];
  sets: Set[];
};

export const useStore = defineStore("store", {
  state() {
    return {
      userData: {} as UserData,
      albums: {} as { [id: string]: EnhancedAlbum },
      trackToAlbum: {} as { [track: string]: string },
      albumTags: new Set<string>(),
      set: {} as EnhancedSet,
      searchResults: [] as AlbumData[],
    };
  },
  actions: {
    loadSet(s: Set) {
      const tracks = s.tracks
        .map((t) => {
          const albumId = this.trackToAlbum[t.id];
          if (!albumId) return;
          const album = this.albums[albumId];
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
      const { data } = await api.post<{ [id: string]: EnhancedAlbum }>(
        `/csv`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      this.albums = data;
    },
    async getUserData() {
      const { data } = await api.get(`/user`, {
        params: { c: true },
      });
      this.userData = data;
      this.processHydratedCollection();
    },
    processHydratedCollection() {
      if (!this.userData.collection) return;
      this.userData.collection.forEach((album: EnhancedAlbum) => {
        // Store the album data
        this.albums[album.id] = album;
        // Update the track-to-album mapping
        album.tracks.forEach((track) => {
          this.trackToAlbum[track.id] = album.id;
        });
        // Store album tags
        album.tags.forEach((tag) => {
          this.albumTags.add(tag);
        });
      });
    },
    async saveUserData() {
      // Dehydrate the collection by extracting only 'id' and 'tags'
      const collection = this.userData.collection.map((album) => ({
        id: album.id,
        tags: album.tags,
      }));
    
      // Send the dehydrated userData to the server
      await api.post(`/user`, {sets: this.userData.sets, collection});
    
      // Fetch the updated userData from the server
      await this.getUserData();
    },
    // Remove or comment out downloadCollection if it's no longer needed
    // async downloadCollection() {
    //   // No longer necessary since collection is hydrated
    // },
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
      const { data } = await api.post<UserData>(`/user/set/new?c=treu`);
      this.userData = data;
      this.processHydratedCollection();
    },
    async addAlbum(id: string) {
      const { data } = await api.get<AlbumData>(`/album-by-id/${id}`);
      this.albums[data.id] = {...data, tags: []};
      data.tracks.forEach((t) => (this.trackToAlbum[t.id] = data.id));
    },
    async addToCollection(id: string) {
      const { data } = await api.put<UserData>(`/user/collection/add/${id}?c=true`);
      this.userData = data;
      this.processHydratedCollection();
    },
    async removeFromCollection(id: string) {
      const { data } = await api.put<UserData>(`/user/collection/remove/${id}?c=true`);
      this.userData = data;
      // Remove the album from the albums store
      const album = this.albums[id];
      album.tracks.forEach(t => delete this.trackToAlbum[t.id])
      delete this.albums[id];
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
      await this.saveUserData();
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
