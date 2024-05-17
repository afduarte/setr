<template lang="pug">
.album-wrapper
  .album(v-if="!current")
    .info
      img(:src="placeHolder")
      p Select a song to start
  .album(v-else, :title="artistNames + ' - ' + current.name")
    .info(v-if="!isExpanded")
      img(:src="image")
      .details
        .artist
          p {{ truncate(artistNames, 25) }}
          p {{ truncate(album.name, 60) }} ({{ album.release_date.split("-").shift() }})
        .tags
          tags-input(@click.stop="", :tags="album.tags", @input="$emit('tags-changed')")
  .suggestions
    .search
      input(type="text", placeholder="Song search...", @input="liveStore.songSearch($event.target.value)")

</template>
<script setup lang="ts">
import placeHolderURL from "@/assets/placeholder.png";
import CollectionTrackDisplay from "./CollectionTrackDisplay.vue";
import TagsInput from "./TagsInput.vue";
import {
  useStore,
  type EnhancedAlbum,
  type EnhancedSet,
  type EnhancedTrack,
} from "@/stores/store";
import { computed, ref, type PropType, type Prop } from "vue";
import { truncate } from "@/utils";
import AlbumList from "./AlbumList.vue";
import { useLiveStore } from "@/stores/liveStore";
defineEmits(["next-click", "track-click", "search"]);
const props = defineProps({
  current: {} as PropType<EnhancedTrack>,
  next: [] as PropType<EnhancedTrack[]>,
  albums: [] as PropType<EnhancedAlbum[]>,
});
const store = useStore();
const liveStore = useLiveStore();
const isExpanded = ref(false);
const liveSet = ref(Set);
const image = computed(() => {
  const c = props.current as EnhancedTrack;
  const albumId = store.getAlbumIdForTrack(c.id);
  if (!albumId) return placeHolder.value;
  const a = props.albums?.find((x) => x.id == albumId);
  return a?.images?.find((i) => !!i)?.url ?? placeHolder.value;
});
const artistNames = computed(() => {
  const c = props.current as EnhancedTrack;
  return c?.artists?.map((a) => a.name).join(", ") ?? "Unknown";
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
  grid-template-columns: 4fr 6fr;
}
</style>
