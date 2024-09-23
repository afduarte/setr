<template lang="pug">
teleport(to="body")
  template(v-if="show")
    .mask(@click="close")
    .modal(@click="close")
      .container(@click.stop="")
        .search
          input(ref="search", type="text", placeholder="Album search...", @input="store.search($event.target.value)")
        .results
          album-display(v-for="a in store.searchResults", :hideTracks="true", :album="a", @click.stop="fetchAlbum(a)")

</template>
<script lang="ts" setup>
import AlbumDisplay from "./AlbumDisplay.vue";
import { useStore, type AlbumData } from "@/stores/store";
import { nextTick, onMounted, ref, toRef, watch } from "vue";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(["close"]);
const store = useStore();
const search = ref<HTMLInputElement | null>(null);
const show = toRef(props, "show");

async function fetchAlbum(a: AlbumData) {
  await store.addToCollection(a.id);
  store.clearSearch();
  emit("close");
}

function close() {
  store.clearSearch();
  emit("close");
}

watch(show, (newVal) => {
  if (newVal) nextTick(() => search.value?.focus());
});
</script>
<style scoped>
.mask {
  z-index: 9;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-background-trans);
}
.modal {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 10fr 1fr;
  z-index: 10;
  position: absolute;
  top: 10%;
}
.container {
  width: 70%;
  grid-column: 2;
  margin: 0 auto;
  padding: 10px;
}
.container input[type="text"] {
  all: unset;
  font-size: 3em;
  width: 100%;
  border-bottom: 2px solid var(--color-text);
}
.results {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  max-height: 70vh;
}
.results > div {
  width: 50%;
  font-weight: bolder;
  margin-top: 10px;
  background-color: var(--color-background-mute);
}
</style>
<style lang="scss" scoped></style>
