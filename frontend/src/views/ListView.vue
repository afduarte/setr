<template lang="pug">
main(:class="{ collection: showCollection, editor: showPlaylist}")
  .collection
    .header
      h2(v-if="showCollection") Collection
      button(v-if="showCollection", @click="showSearch = !showSearch") Add Album
      button.caret(@click="showCollection = !showCollection") {{ showCollection? '‹': '›' }}
    album-list(v-if="showCollection", :albums="albums", @track-click="addTrack")
  .editor
    .header
      button.caret(@click="showPlaylist = !showPlaylist") {{ showPlaylist? '›' : '‹' }}
      h1(v-if="showPlaylist") Playlist 
        span(v-if="showPlaylist && setLength > 0") - {{ humaniseDuration(setLength) }}  
      button(v-if="showPlaylist", @click="lockPlaylist = !lockPlaylist") {{ lockPlaylist? 'Unlock' : 'Lock' }}
      button(v-if="showPlaylist", @click="showTransitioner = !showTransitioner") Transitioner
    playlist-editor(v-if="showPlaylist", @track-click="removeTrack", :lock="lockPlaylist")
  search-modal(:show="showSearch", @close="showSearch = false")
  transitioner-modal(:show="showTransitioner", @close="showTransitioner = false")
</template>
<script setup lang="ts">
import AlbumList from "@/components/AlbumList.vue";
import PlaylistEditor from "@/components/PlaylistEditor.vue";
import SearchModal from "@/components/SearchModal.vue";
import TransitionerModal from "@/components/TransitionerModal.vue";
import { useStore, type TrackClickEvent, type TrackData } from "@/stores/store";
import { formatDuration, getNewKey } from "@/utils";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";

const store = useStore();
const showSearch = ref(false);
const showTransitioner = ref(false);
const showCollection = ref(true);
const showPlaylist = ref(true);
const lockPlaylist = ref(false);
const { albums, playlist } = storeToRefs(store);
function addTrack(t: TrackClickEvent) {
  store.addTrack(t.track);
}
function removeTrack(t: TrackClickEvent) {
  store.removeTrack(t);
}
const setLength = computed(() =>
  playlist.value.reduce((prev: number, track: TrackData) => {
    return prev + (track.audioFeatures?.duration_ms || 0);
  }, 0)
);
function humaniseDuration(duration: number) {
  return formatDuration(duration);
}
</script>
<style lang="scss" scoped>
main {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  &.collection {
    grid-template-columns: 10fr 1fr;
  }
  &.editor {
    grid-template-columns: 1fr 10fr;
  }
  &.collection.editor {
    grid-template-columns: 7fr 10fr;
  }
  .header {
    display: flex;
    flex-direction: row;
  }
}
.caret {
  border: none;
  background: none;
  font-size: 3rem;
}
</style>
