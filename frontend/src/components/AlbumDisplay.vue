<template lang="pug">
.album-wrapper
  p.cross(@click="$emit('cross-click')") ❌
  .album(v-if="isMissingAlbum")
    .info
      img(:src="placeHolder")
      p {{ album }}
  .album(v-else)
    .info
      img(:src="image")
      .details
        .artist
        p {{ artistNames }}
          p {{ album.name }} ({{ album.release_date.split("-").shift() }})
        .tags
          tags-input(:tags="[]")
    .tracks(v-if="!hideTracks")
      .banner(@click.stop="isExpanded = !isExpanded")
        p Tracks
        b {{ isExpanded ? '▲' : '▼' }}
      simple-track-display(v-if="isExpanded", v-for="(t,i) in album.tracks", :track="t", @click.stop="$emit('track-click', {track:t,index:i})")

</template>
<script setup lang="ts">
import placeHolderURL from "@/assets/placeholder.png";
import SimpleTrackDisplay from "./SimpleTrackDisplay.vue";
import TagsInput from "./TagsInput.vue";
import type { AlbumData } from "@/stores/store";
import { computed, ref, type PropType } from "vue";
import AlbumList from "./AlbumList.vue";
defineEmits(["track-click"]);
const props = defineProps({
  album: {} as PropType<AlbumData | string>,
  hideTracks: Boolean,
});
const isExpanded = ref(false);
const isMissingAlbum = computed(() => typeof props?.album === "string");
const image = computed(() => {
  const a = props.album as AlbumData;
  return a?.images?.find((i) => !!i)?.url || "@/assets/placeholder.png";
});
const artistNames = computed(() => {
  const a = props.album as AlbumData;
  return a?.artists?.map((a) => a.name).join(", ");
});
const placeHolder = computed(() => placeHolderURL);
</script>
<style lang="scss" scoped>
.album {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
  .info {
    display: flex;
    flex-direction: row;
    img {
      width: 50px;
      height: 50px;
      margin-right: 5px;
      border-radius: 5px;
    }
  }
  .tracks {
    display: flex;
    flex-direction: column;
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
