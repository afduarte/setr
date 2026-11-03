<template lang="pug">
.album-wrapper(:class="{ selectable, disabled, unselected: selectable && !selected && !disabled }")
  p.cross(v-if="!selectable", @click="$emit('cross-click')") ❌
  .album(v-if="isMissingAlbum")
    .info
      img(:src="placeHolder")
      p {{ album }}
  .album(v-else, @click="onClick")
    .info
      img(:src="image", loading="lazy")
      .details
        .artist
        p {{ hideArtist ? '' : artistNames + ' ' }}
          span {{ album.name }} ({{ (album.release_date || "").split("-").shift() }})
        .tags(v-if="!selectable")
          tags-input(:tags="album.tags", @input="$emit('tags-changed')")
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
import type { EnhancedAlbum } from "@/stores/store";
import { computed, ref, type PropType } from "vue";
const emit = defineEmits(["track-click", "tags-changed", "cross-click", "select"]);
const props = defineProps({
  album: {} as PropType<EnhancedAlbum | string>,
  hideTracks: Boolean,
  hideArtist: Boolean,
  selectable: Boolean,
  selected: Boolean,
  disabled: Boolean,
});
const isExpanded = ref(false);
const isMissingAlbum = computed(() => typeof props?.album === "string");
const image = computed(() => {
  const a = props.album as EnhancedAlbum;
  return a?.images?.find((i) => !!i)?.url || placeHolderURL;
});
const artistNames = computed(() => {
  const a = props.album as EnhancedAlbum;
  return a?.artists?.map((a) => a.name).join(", ");
});
const placeHolder = computed(() => placeHolderURL);
function onClick() {
  if (props.selectable && !props.disabled) emit("select");
}
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
.album-wrapper.selectable {
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
.album-wrapper.selectable {
  grid-template-columns: 1fr;
}
.album-wrapper.disabled,
.album-wrapper.unselected {
  opacity: 0.4;
}
</style>
