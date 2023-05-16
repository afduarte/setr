<template lang="pug">
.albums(v-if="albums?.length")
  .holder(v-for="(a, idx) in sortedAlbums")
    .letter
      h2(v-if="isFirstOfLetter(a, idx)") {{ getLetter(a) }}
    album-display(:album="a", @track-click="$emit('track-click', $event)", @cross-click="$emit('album-delete', a)")
</template>
<script setup lang="ts">
import AlbumDisplay from "./AlbumDisplay.vue";
import { getSortingString, type AlbumData } from "@/stores/store";
import { computed } from "vue";
const props = defineProps<{ albums?: (AlbumData | string)[] }>();
defineEmits(["track-click", "album-delete"]);
const sortedAlbums = computed(() => {
  if (!props?.albums) return [];
  return [...props.albums].sort((a, b) => {
    const aString = typeof a === "string" ? a : getSortingString(a);
    const bString = typeof b === "string" ? b : getSortingString(b);
    return aString.localeCompare(bString);
  });
});
function isFirstOfLetter(a:AlbumData | string, idx:number) {
  if(idx == 0) return true;
  if(idx == sortedAlbums.value.length - 1) return false;
  const aString = typeof a === "string" ? a : getSortingString(a);
  const prev = sortedAlbums.value[idx - 1];
  const prevString = typeof prev === "string" ? prev : getSortingString(prev);
  if(aString[0] != prevString[0]) return true;
}

function getLetter(a:AlbumData| string){
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
  }
}
</style>
<style scoped>
.letter h2 {
  border-top: 1px solid var(--color-text);
}
</style>
