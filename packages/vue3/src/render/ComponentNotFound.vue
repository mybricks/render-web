<!-- 找不到组件 -->
<template>
  <div :class="classes.error">
    {{ content }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  content?,
}>();
</script>

<style lang="less" module="classes">
@color-error: #f5222d;

.error {
  font-size: 12px;
  color: @color-error;
  overflow: hidden;
}

.errorRT {
  padding: 5px;
  border: 1px dashed @color-error;

  .tt {
    font-size: 12px;
    color: @color-error;
    font-weight: bold;
    margin-bottom: 5px;
  }

  .info {
    color: @color-error;
    margin-bottom: 5px;
  }
}
</style>