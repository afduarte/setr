import { defineStore } from "pinia";
import axios from "axios";
import { useLocalStorage } from "@vueuse/core";
import { getSpotifyIDFromURL } from "@/utils";

export function getSortingString(a: AlbumData): string {
  const artist = a.artists.map((a) => a.name).join();
  const date = a.release_date.split("-").shift();
  const title = a.name;
  return `${artist} ${date} ${title}`;
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

export const useStore = defineStore("store", {
  state() {
    return {
      albums: useLocalStorage<(AlbumData | string)[]>("albums", []),
      playlist: useLocalStorage<EnhancedTrack[]>("playlist", []),
      searchResults: [] as AlbumData[],
    };
  },
  actions: {
    async uploadCSV(f: File) {
      const formData = new FormData();
      formData.append("csv", f);

      const { data } = await axios.post<(AlbumData | string)[]>(
        `/api/csv`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      this.albums = data;
    },
    async search(q: string) {
      if (q.includes("spotify")) {
        const id = getSpotifyIDFromURL(q);
        const { data } = await axios.get<AlbumData>(`/api/album-by-id/${id}`);
        this.searchResults = [data];
      } else {
        const { data } = await axios.get<AlbumData[]>("/api/search", {
          params: { q },
        });
        this.searchResults = data;
      }
    },
    clearSearch() {
      this.searchResults = [];
    },
    async addAlbum(id: string) {
      const { data } = await axios.get<AlbumData>(`/api/album-by-id/${id}`);
      this.albums.push(data);
    },
    addTrack(t: TrackData) {
      // Turn the track into an enhanced track so we persist notes and adjustment data
      this.playlist.push({ ...t, note: "", adjustment: 0 });
    },
    removeTrack(t: TrackClickEvent) {
      this.playlist.splice(t.index, 1);
    },
  },
});
