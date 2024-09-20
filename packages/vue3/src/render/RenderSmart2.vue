<template>
  <RenderSmart
    v-for="props in elements"
    :key="props.com.id"
    v-bind="props"
  />
</template>

<script setup lang="ts">
import RenderSmart from './RenderSmart.vue';
const props = defineProps<{
  elements?
}>()

</script>
