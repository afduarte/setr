import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import { api, getSpotifyIDFromURL } from "@/utils";
import { ref, computed } from "vue";

export function getSortingString(a: EnhancedAlbum): string {
  const artist = a.artists
    .map((a) =>
      a.name
        .replace(/^[Tt]he\s*/, "")
        .replace(/[Vv]arious\s*[Aa]rtists\s*/, "")
        .replace(/^\d/, "#"),
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

export const useStore = defineStore("store", () => {
  // State variables initialized as refs
  const userData = ref<UserData>({} as UserData);
  const collection = ref<AlbumMeta[]>([]);
  const albums = useStorage<{ [id: string]: AlbumData }>("albums", {});
  const trackToAlbum = ref<{ [track: string]: string }>({});
  const albumTags = ref<{ [tag: string]: boolean }>({});
  const set = ref<EnhancedSet>({} as EnhancedSet);
  const searchResults = ref<AlbumData[]>([]);

  // Actions
  function logout() {
    albums.value = {};
  }

  async function loadSet(s: Set) {
    const tracks = s.tracks
      .map((t) => {
        const albumId = trackToAlbum.value[t.id];
        if (!albumId) return;
        const album = albums.value[albumId];
        if (!album) return;
        const track = album.tracks.find((x) => x.id === t.id);
        if (!track) return;
        return {
          ...track,
          adjustment: t.adjustment,
          note: t.note,
        } as EnhancedTrack;
      })
      .filter(Boolean) as EnhancedTrack[];

    set.value = { ...s, tracks };
  }

  async function uploadCSV(f: File) {
    const formData = new FormData();
    formData.append("csv", f);
    const { data } = await api.post<{ [id: string]: AlbumData }>(
      `/csv`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    albums.value = data;
  }

  async function getUserData() {
    console.log("getting user data");
    const { data } = await api.get<UserData>(`/user`);
    userData.value = data;
    console.log("user data got", userData.value);
    await downloadCollection();
  }

  async function saveUserData() {
    await api.post(`/user`, userData.value);
    await getUserData();
  }

  async function downloadCollection() {
    console.log("downloading collection");
    const promises = userData.value.collection.map(async (a?: AlbumMeta) => {
      if (!a) return;
      console.log(`album (${a?.id})`, a);
      if (!albums?.value[a?.id]) {
        a.tags.forEach((t) => (albumTags.value[t] = true));
        await addAlbum(a.id);
      } else {
        const album = albums.value[a.id];
        album.tracks.forEach((t) => (trackToAlbum.value[t.id] = album.id));
      }
    });
    await Promise.all(promises);
  }

  async function search(q: string) {
    if (q.includes("spotify")) {
      const id = getSpotifyIDFromURL(q);
      const { data } = await api.get<AlbumData>(`/album-by-id/${id}`);
      searchResults.value = [data];
    } else {
      const { data } = await api.get<AlbumData[]>("/search", {
        params: { q },
      });
      searchResults.value = data;
    }
  }

  function clearSearch() {
    searchResults.value = [];
  }

  async function addSet() {
    const { data } = await api.post<UserData>(`/user/set/new`);
    userData.value = data;
  }

  async function addAlbum(id: string) {
    const { data } = await api.get<AlbumData>(`/album-by-id/${id}`);
    albums.value[data.id] = data;
    data.tracks.forEach((t) => (trackToAlbum.value[t.id] = data.id));
  }

  async function addToCollection(id: string) {
    const { data } = await api.put<UserData>(`/user/collection/add/${id}`);
    userData.value = data;
    await downloadCollection();
  }

  async function removeFromCollection(id: string) {
    const { data } = await api.put<UserData>(`/user/collection/remove/${id}`);
    userData.value = data;
    await downloadCollection();
  }

  function addTrack(t: TrackData) {
    set.value.tracks.push({ ...t, note: "", adjustment: 0 });
    updateMetaSet();
  }

  function removeTrack(t: TrackClickEvent) {
    set.value.tracks.splice(t.index, 1);
    updateMetaSet();
  }

  async function updateMetaSet() {
    const idx = userData.value.sets.findIndex((x) => x.id === set.value.id);
    if (idx < 0) return;
    userData.value.sets[idx].tracks = set.value.tracks.map((et) => ({
      id: et.id,
      note: et.note,
      adjustment: et.adjustment,
    }));
    await saveUserData();
  }

  // Getters
  const getAlbumIdForTrack = computed(() => {
    return (trackId: string) => trackToAlbum.value[trackId];
  });

  const allTracks = computed(() => {
    return Object.values(albums.value)
      .flatMap((a) => a.tracks)
      .reduce(
        (acc, next) => {
          acc[next.id] = next;
          return acc;
        },
        {} as { [id: string]: TrackData },
      );
  });

  // Return state, actions, and getters
  return {
    userData,
    collection,
    albums,
    trackToAlbum,
    albumTags,
    set,
    searchResults,
    logout,
    loadSet,
    uploadCSV,
    getUserData,
    saveUserData,
    downloadCollection,
    search,
    clearSearch,
    addSet,
    addAlbum,
    addToCollection,
    removeFromCollection,
    addTrack,
    removeTrack,
    updateMetaSet,
    getAlbumIdForTrack,
    allTracks,
  };
});
