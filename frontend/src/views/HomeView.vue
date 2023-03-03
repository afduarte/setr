<template lang="pug">
main
  div(v-bind="getRootProps()")
    input(v-bind="getInputProps()")
    .dropzone Drop a CSV file here or click to open the file explorer. The CSV must contain a header file with Artist and Title columns.
  </template>
<script setup lang="ts">
import { useDropzone, type FileUploadOptions } from "vue3-dropzone";
import { useStore } from "@/stores/store";
import { useRouter } from "vue-router";

const store = useStore();
const router = useRouter();
async function onDrop(acceptFiles: File[], rejectReasons: any) {
  if (!acceptFiles.length) return;

  await store.uploadCSV(acceptFiles[0]);
  router.push({ name: "list" });
}

const options: Partial<FileUploadOptions> = { onDrop };
const { getRootProps, getInputProps } = useDropzone(options);
</script>
<style lang="scss" scoped>
.dropzone {
  border: 3px dashed #ccc;
  padding: 20px;
}
</style>
