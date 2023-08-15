<template lang="pug">
.tags
  smart-tagz(
    autosuggest
    editable
    inputPlaceholder="Tags..."
    :sources="tagsList"
    :allowPaste="{delimiter: ','}"
    :allowDuplicates="false",
    :theme="colours"
    )
</template>
<script setup lang="ts">
import { useStore } from "@/stores/store";
import { storeToRefs } from "pinia";
import { SmartTagz } from "smart-tagz";
import "smart-tagz/dist/smart-tagz.css";
import { computed } from "vue";
const store = useStore();
const { albumTags } = storeToRefs(store);
const tagsList = computed(() => Object.values(albumTags.value));
const colours = {
  primary: "var(--color-primary)",
  background: "var(--color-background-soft)",
  tagTextColor: "var(--color-text)",
};
</script>
<style lang="scss" scoped>
.tags-main {
  padding: 2px;
}
</style>
