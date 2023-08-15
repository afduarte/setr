<template lang="pug">
.albums(v-if="albums?.length")
  .holder(v-for="(a, idx) in sortedAlbums")
    .letter
      h2(v-if="a && isFirstOfLetter(a, idx)") {{ getLetter(a) }}
    album-grid-display(v-if="a", :album="a", @track-click="$emit('track-click', $event)", @cross-click="$emit('album-delete', a)")
</template>
<script setup lang="ts">
import AlbumGridDisplay from "@/components/AlbumGridDisplay.vue";
import { getSortingString, type EnhancedAlbum } from "@/stores/store";
import { computed } from "vue";
const props = defineProps<{ albums?: (EnhancedAlbum | string)[] }>();
defineEmits(["track-click", "album-delete"]);
const sortedAlbums = computed(() => {
  if (!props?.albums) return [];
  return [...props.albums].sort((a, b) => {
    const aString = typeof a === "string" ? a : getSortingString(a);
    const bString = typeof b === "string" ? b : getSortingString(b);
    return aString.localeCompare(bString);
  });
});
function isFirstOfLetter(a: EnhancedAlbum | string, idx: number) {
  if (idx == 0) return true;
  if (idx == sortedAlbums.value.length - 1) return false;
  const aString = typeof a === "string" ? a : getSortingString(a);
  const prev = sortedAlbums.value[idx - 1];
  const prevString = typeof prev === "string" ? prev : getSortingString(prev);
  if (!aString.startsWith(prevString[0])) return true;

  return false;
}

function getLetter(a: EnhancedAlbum | string) {
  const aString = typeof a === "string" ? a : getSortingString(a);
  return aString[0].toUpperCase().replace(/d+/, "#");
}
</script>
<style lang="scss" scoped>
.albums {
  max-height: 85vh;
  overflow-y: scroll;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  .holder {
    display: grid;
    grid-template-columns: 1fr 15fr;
  }
}
</style>
<style scoped>
.letter h2 {
  height: 100%;
  border-right: 1px solid var(--color-text);
}
</style>
