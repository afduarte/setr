<template lang="pug">
.albums(v-if="albums?.length", :class="{ grouped }")
  template(v-if="grouped")
    .letter-group(v-for="group in groupedAlbums", :key="group.letter")
      .letter
        h2 {{ group.letter }}
      .artists
        template(v-for="artist in group.artists", :key="artist.name")
          p.artist-name(
            :class="{ unselected: selectable && !isArtistSelected(artist) }",
            @click="$emit('artist-click', artist)"
          ) {{ artist.name }}
          .artist-albums
            album-display(
              v-for="a in artist.albums",
              :key="a.id",
              :album="a",
              :hide-tracks="hideTracks",
              :hide-artist="true",
              :selectable="selectable",
              :selected="isSelected(a)",
              :disabled="isDisabled(a)",
              @select="$emit('select', a)"
            )
  template(v-else)
    .holder(v-for="(a, idx) in sortedAlbums", :class="{ noLetter: !letters }")
      .letter(v-if="letters")
        h2(v-if="isFirstOfLetter(a, idx)") {{ getLetter(a) }}
      album-display(
        :album="a",
        :hide-tracks="hideTracks",
        :selectable="selectable",
        :selected="isSelected(a)",
        :disabled="isDisabled(a)",
        @track-click="$emit('track-click', $event)",
        @cross-click="$emit('album-delete', a)",
        @tags-changed="$emit('user-save')",
        @select="$emit('select', a)"
      )
</template>
<script setup lang="ts">
import AlbumDisplay from "./AlbumDisplay.vue";
import { getSortingString, type EnhancedAlbum } from "@/stores/store";
import { computed } from "vue";
const props = withDefaults(
  defineProps<{
    albums?: (EnhancedAlbum | string)[];
    selectable?: boolean;
    selectedIds?: Set<string>;
    disabledIds?: Set<string>;
    hideTracks?: boolean;
    letters?: boolean;
    grouped?: boolean;
    sorter?: (a: EnhancedAlbum, b: EnhancedAlbum) => number;
  }>(),
  { letters: true }
);
defineEmits(["track-click", "album-delete", "user-save", "select", "artist-click"]);
const sortedAlbums = computed(() => {
  if (!props?.albums) return [];
  if (props.sorter) return [...props.albums].sort(props.sorter);
  return [...props.albums].sort((a, b) => {
    const aString = typeof a === "string" ? a : getSortingString(a);
    const bString = typeof b === "string" ? b : getSortingString(b);
    return aString.localeCompare(bString);
  });
});

// --- grouping -------------------------------------------------------------
type ArtistGroup = { name: string; albums: EnhancedAlbum[] };
type LetterGroup = { letter: string; artists: ArtistGroup[] };

function artistOf(a: EnhancedAlbum) {
  return a.artists?.map((x) => x.name).filter(Boolean).join(", ") || "Unknown artist";
}
// Sort/letter by name ignoring a leading "The" / "Various Artists" so albums
// file the same way the flat list sorts them.
function artistSortKey(name: string) {
  return (
    name.replace(/^[Tt]he\s*/, "").replace(/^[Vv]arious\s*[Aa]rtists\s*/, "") || name
  );
}
function letterOf(name: string) {
  return artistSortKey(name)[0]?.toUpperCase().replace(/\d/, "#") || "#";
}
const groupedAlbums = computed<LetterGroup[]>(() => {
  const list = (props.albums || []).filter(
    (a): a is EnhancedAlbum => typeof a !== "string"
  );
  const compare =
    props.sorter ||
    ((a: EnhancedAlbum, b: EnhancedAlbum) =>
      getSortingString(a).localeCompare(getSortingString(b)));

  const byArtist = new Map<string, EnhancedAlbum[]>();
  for (const a of list) {
    const name = artistOf(a);
    if (!byArtist.has(name)) byArtist.set(name, []);
    byArtist.get(name)!.push(a);
  }

  const artists = [...byArtist.entries()].map(([name, albums]) => {
    albums.sort(compare);
    return { name, albums };
  });
  artists.sort((a, b) =>
    artistSortKey(a.name).toLowerCase().localeCompare(artistSortKey(b.name).toLowerCase())
  );

  const letters = new Map<string, ArtistGroup[]>();
  for (const artist of artists) {
    const letter = letterOf(artist.name);
    if (!letters.has(letter)) letters.set(letter, []);
    letters.get(letter)!.push(artist);
  }
  return [...letters.entries()].map(([letter, artists]) => ({ letter, artists }));
});

// --- selection helpers ----------------------------------------------------
function isSelected(a: EnhancedAlbum | string) {
  return !!(props.selectable && props.selectedIds && typeof a !== "string" && props.selectedIds.has(a.id));
}
function isDisabled(a: EnhancedAlbum | string) {
  return !!(props.disabledIds && typeof a !== "string" && props.disabledIds.has(a.id));
}
function isArtistSelected(artist: ArtistGroup) {
  return !!props.selectedIds && artist.albums.some((a) => props.selectedIds!.has(a.id));
}
function isFirstOfLetter(a: EnhancedAlbum | string, idx: number) {
  if (idx == 0) return true;
  if (idx == sortedAlbums.value.length - 1) return false;
  const aString = typeof a === "string" ? a : getSortingString(a);
  const prev = sortedAlbums.value[idx - 1];
  const prevString = typeof prev === "string" ? prev : getSortingString(prev);
  if (!aString.startsWith(prevString[0])) return true;
}

function getLetter(a: EnhancedAlbum | string) {
  const aString = typeof a === "string" ? a : getSortingString(a);
  return aString[0];
}
</script>
<style lang="scss" scoped>
.albums {
  max-height: 85vh;
  overflow-y: scroll;
  .holder {
    display: grid;
    grid-template-columns: 1fr 10fr;
    &.noLetter {
      grid-template-columns: 1fr;
    }
  }
  &.grouped .letter-group {
    display: grid;
    grid-template-columns: min-content 1fr;
    column-gap: 10px;
  }
  &.grouped .letter h2 {
    border-top: 1px solid var(--color-text);
    padding-right: 10px;
  }
  &.grouped .artists {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) 3fr;
    align-items: start;
    padding-bottom: 10px;
    border-top: 1px solid var(--color-text);
  }
  &.grouped .artist-name {
    cursor: pointer;
    font-weight: bold;
    margin: 5px 0;
    &:hover {
      color: var(--color-primary);
    }
    &.unselected {
      opacity: 0.4;
    }
  }
  &.grouped .artist-albums {
    min-width: 0;
  }
}
</style>
<style scoped>
.letter h2 {
  border-top: 1px solid var(--color-text);
}
</style>
