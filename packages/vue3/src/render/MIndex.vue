<template>
  <div>
    <MMain />
    <MMultiScene />
  </div>
</template>

<script setup lang="ts">
import MMain from "./MMain.vue";
import MMultiScene from './MMultiScene.vue';
import { Context, Stylization } from './index';
const props = defineProps<{
  json: any;
  options: any;
}>();
</script>

<style scoped>

</style>