<!-- 没有权限展示的链接 -->
<template>
  <div>
    <a
      :href='href'
      :target='target'
      :style='style'
    >
      {{ content }}
    </a>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  href?,
  target?,
  style?,
  content?,
}>();
</script>

<style scoped>

</style>