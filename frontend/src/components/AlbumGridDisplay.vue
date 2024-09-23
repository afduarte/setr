<template lang="pug">
.album-wrapper
  p.cross(@click="$emit('cross-click')") ❌
  .album(v-if="isMissingAlbum")
    .info
      img(:src="placeHolder")
      p {{ album }}
  .album(v-else, @click="isExpanded = !isExpanded", :title="artistNames + ' - ' + album.name")
    .info(v-if="!isExpanded")
      img(:src="image")
      .details
        .artist
          p {{ truncate(artistNames, 25) }}
          p {{ truncate(album.name, 60) }} ({{ album.release_date.split("-").shift() }})
        .tags
          tags-input(@click.stop="", :tags="album.tags", @input="$emit('tags-changed')")
    .tracks(v-if="isExpanded")
      collection-track-display(v-if="isExpanded", v-for="(t,i) in album.tracks", :track="t")

</template>
<script setup lang="ts">
import placeHolderURL from "@/assets/placeholder.png";
import CollectionTrackDisplay from "./CollectionTrackDisplay.vue";
import TagsInput from "./TagsInput.vue";
import type { EnhancedAlbum } from "@/stores/store";
import { computed, ref, type PropType } from "vue";
import { truncate } from "@/utils";
import AlbumList from "./AlbumList.vue";
defineEmits(["track-click"]);
const props = defineProps({
  album: {} as PropType<EnhancedAlbum | string>,
  hideTracks: Boolean,
});
const isExpanded = ref(false);
const isMissingAlbum = computed(() => typeof props?.album === "string");
const image = computed(() => {
  const a = props.album as EnhancedAlbum;
  return a?.images?.find((i) => !!i)?.url ?? "@/assets/placeholder.png";
});
const artistNames = computed(() => {
  const a = props.album as EnhancedAlbum;
  return a?.artists?.map((a) => a.name).join(", ");
});
const placeHolder = computed(() => placeHolderURL);
</script>
<style lang="scss" scoped>
.album {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
  height: 45vh;
  .info {
    display: flex;
    flex-direction: column;
    font-size: 1.1em;
    height: 100%;
    .details {
      text-align: center;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      justify-content: space-between;
    }
    img {
      transition: height 300ms ease-in-out, transform 300ms ease-in-out;
      width: 12vw;
      height: 12vw;
      margin: 10px auto;
      border-radius: 5px;
      &:hover {
        transform: scale(1.1);
      }
    }
  }
  .tracks {
    display: flex;
    flex-direction: column;
    max-height: 100%;
    overflow-y: scroll;
    transition: visibility 300ms ease-in-out;
    .banner {
      padding-right: 5px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    }
  }
}
.cross {
  cursor: pointer;
}
</style>
<style scoped>
.album-wrapper {
  border-top: 1px solid var(--color-text);
  padding-top: 5px;
  display: grid;
  grid-template-columns: 2fr 45fr;
}
</style>
