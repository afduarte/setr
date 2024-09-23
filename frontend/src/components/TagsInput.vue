<template lang="pug">
.tags
  smart-tagz(
    autosuggest
    editable
    inputPlaceholder="Tags..."
    :sources="tagsList"
    :allowPaste="{delimiter: ','}"
    :allowDuplicates="false",
    :theme="colours",
    :on-changed="(a,b,c) => console.log(a,b,c)"
    )
</template>
<script setup lang="ts">
import { useStore } from "@/stores/store";
import { storeToRefs } from "pinia";
import { SmartTagz } from "smart-tagz";
import "smart-tagz/dist/smart-tagz.css";
import { computed } from "vue";
defineEmits(["input"]);
const store = useStore();
const { albumTags } = storeToRefs(store);
const tagsList = computed(() => [...albumTags.value]);
const colours = {
  primary: "var(--color-primary)",
  background: "var(--color-background-soft)",
  tagTextColor: "var(--color-text)",
};
// const tagsChanged = (a,b,c) => console.log(a,b,c)
</script>
<style lang="scss" scoped>
.tags-main {
  padding: 2px;
}
</style>
