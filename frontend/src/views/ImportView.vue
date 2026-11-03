<template lang="pug">
main
  .header
    h1 Import Albums
    .actions
      button(@click="selectAll", :disabled="!selectableIds.size") Select All
      button(@click="selectNone", :disabled="!toImport.length") Select None
      button(@click="importSelected", :disabled="!toImport.length") Add {{ toImport.length }} to Collection
  .container
    aside.facets
      input.search(type="text", v-model="query", placeholder="Search name or artist...")
      .facet(v-for="group in facetGroups", :key="group.key")
        .facet-title {{ group.label }}
        label.facet-item(v-for="opt in group.options", :key="opt.value")
          input(type="checkbox", :checked="facets[group.key].has(opt.value)", @change="toggle(group.key, opt.value)")
          span.value {{ opt.value }}
          span.count {{ opt.count }}
      button.clear(v-if="hasFilters", @click="clearFilters") Clear filters
    section.results
      .list-header
        span {{ visibleAlbums.length }} albums
        .sort
          label Sort
          select(v-model="sortField")
            option(value="artist") Artist
            option(value="album") Album
            option(value="year") Year
          button(@click="sortAsc = !sortAsc") {{ sortAsc ? '▲' : '▼' }}
      album-list(
        :albums="visibleAlbums",
        :selectable="true",
        :selected-ids="selectedIds",
        :disabled-ids="collectionIds",
        :hide-tracks="true",
        :letters="sortField === 'artist'",
        :grouped="true",
        :sorter="sorter",
        @select="toggleSelected($event.id)",
        @artist-click="toggleArtist"
      )
</template>
<script setup lang="ts">
import AlbumList from "@/components/AlbumList.vue";
import { getSortingString, useStore, type AlbumData } from "@/stores/store";
import { storeToRefs } from "pinia";
import { computed, onMounted, reactive, ref } from "vue";

type FacetKey = "artist" | "decade" | "status";
const FACET_KEYS: FacetKey[] = ["artist", "decade", "status"];
const DEFAULT_STATUS = "Not in collection";

const store = useStore();
const { allAlbums, userData } = storeToRefs(store);
const query = ref("");
const sortField = ref<"artist" | "album" | "year">("artist");
const sortAsc = ref(true);
// Track what's NOT selected so every album is selected by default and stays
// selected as filters change.
const deselected = ref(new Set<string>());
const facets = reactive<Record<FacetKey, Set<string>>>({
  artist: new Set(),
  decade: new Set(),
  // Already-imported albums are hidden by default.
  status: new Set([DEFAULT_STATUS]),
});

onMounted(async () => {
  if (!allAlbums.value.length) await store.getAllAlbums();
});

// --- album -> facet values ------------------------------------------------
const collectionIds = computed(
  () => new Set((userData.value.collection || []).map((a) => a.id))
);
const inCollection = (id: string) => collectionIds.value.has(id);
function yearOf(a: AlbumData) {
  return Number((a.release_date || "").split("-")[0]) || 0;
}
function decadeOf(a: AlbumData) {
  const y = yearOf(a);
  return y ? `${Math.floor(y / 10) * 10}s` : "Unknown year";
}
function facetValues(a: AlbumData): Record<FacetKey, string[]> {
  return {
    artist: a.artists?.map((x) => x.name).filter(Boolean) || ["Unknown artist"],
    decade: [decadeOf(a)],
    status: [inCollection(a.id) ? "In collection" : "Not in collection"],
  };
}

// --- filtering ------------------------------------------------------------
function passes(a: AlbumData, exclude?: FacetKey) {
  const q = query.value.trim().toLowerCase();
  if (q) {
    const hay = [a.name, ...(a.artists?.map((x) => x.name) || [])]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const values = facetValues(a);
  for (const key of FACET_KEYS) {
    if (key === exclude) continue;
    const sel = facets[key];
    if (sel.size && !values[key].some((v) => sel.has(v))) return false;
  }
  return true;
}
function countFor(key: FacetKey, value: string) {
  return allAlbums.value.filter(
    (a) => passes(a, key) && facetValues(a)[key].includes(value)
  ).length;
}

// --- facet option lists ---------------------------------------------------
const artistValues = computed(() => {
  const set = new Set<string>();
  allAlbums.value.forEach((a) => facetValues(a).artist.forEach((v) => set.add(v)));
  return [...set].sort((a, b) => a.localeCompare(b));
});
const decadeValues = computed(() => {
  const set = new Set<string>();
  allAlbums.value.forEach((a) => set.add(decadeOf(a)));
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
});
const facetGroups = computed(() => [
  { key: "artist" as FacetKey, label: "Artist", options: artistValues.value.map((v) => ({ value: v, count: countFor("artist", v) })) },
  { key: "decade" as FacetKey, label: "Decade", options: decadeValues.value.map((v) => ({ value: v, count: countFor("decade", v) })) },
  { key: "status" as FacetKey, label: "Status", options: ["Not in collection", "In collection"].map((v) => ({ value: v, count: countFor("status", v) })) },
]);

// --- sorting / derived lists ----------------------------------------------
const sorter = computed(() => {
  const field = sortField.value;
  const asc = sortAsc.value;
  return (a: AlbumData, b: AlbumData) => {
    let r = 0;
    if (field === "album") r = a.name.localeCompare(b.name);
    else if (field === "year") r = yearOf(a) - yearOf(b);
    else r = getSortingString(a as any).localeCompare(getSortingString(b as any));
    return asc ? r : -r;
  };
});
const visibleAlbums = computed(() => allAlbums.value.filter((a) => passes(a)));
const selectableIds = computed(
  () => new Set(visibleAlbums.value.filter((a) => !inCollection(a.id)).map((a) => a.id))
);
const selectedIds = computed(
  () => new Set(visibleAlbums.value.filter((a) => !deselected.value.has(a.id)).map((a) => a.id))
);
const toImport = computed(() =>
  [...selectableIds.value].filter((id) => !deselected.value.has(id))
);

// --- actions --------------------------------------------------------------
function toggle(key: FacetKey, value: string) {
  const set = facets[key];
  set.has(value) ? set.delete(value) : set.add(value);
}
function toggleSelected(id: string) {
  deselected.value.has(id) ? deselected.value.delete(id) : deselected.value.add(id);
}
// Clicking an artist selects/deselects all of its importable albums at once.
function toggleArtist(artist: { albums: AlbumData[] }) {
  const ids = artist.albums.filter((a) => !inCollection(a.id)).map((a) => a.id);
  if (!ids.length) return;
  const allSelected = ids.every((id) => !deselected.value.has(id));
  ids.forEach((id) =>
    allSelected ? deselected.value.add(id) : deselected.value.delete(id)
  );
}
const hasFilters = computed(() => {
  if (query.value) return true;
  if (facets.artist.size || facets.decade.size) return true;
  // The default status filter alone doesn't count as "filtered".
  return !(facets.status.size === 1 && facets.status.has(DEFAULT_STATUS));
});
function clearFilters() {
  query.value = "";
  facets.artist.clear();
  facets.decade.clear();
  facets.status.clear();
  facets.status.add(DEFAULT_STATUS);
}
function selectAll() {
  deselected.value = new Set();
}
function selectNone() {
  deselected.value = new Set(selectableIds.value);
}
async function importSelected() {
  await store.importAlbums(toImport.value);
}
</script>
<style lang="scss" scoped>
.header {
  display: flex;
  align-items: center;
  gap: 20px;
  button {
    margin-right: 5px;
  }
}
.container {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
}
.facets {
  max-height: 82vh;
  overflow-y: auto;
  padding-right: 8px;
  .search {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    padding: 5px;
    margin-bottom: 10px;
    border-bottom: 2px solid var(--color-text);
  }
  .facet-title {
    font-weight: bold;
    margin-top: 10px;
  }
  .facet-item {
    display: grid;
    grid-template-columns: 20px 1fr auto;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    padding: 2px 0;
    .count {
      color: var(--color-text);
      opacity: 0.6;
      font-size: 0.85em;
    }
  }
  .clear {
    margin-top: 10px;
  }
}
.results {
  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    .sort {
      display: flex;
      align-items: center;
      gap: 5px;
    }
  }
}
</style>
