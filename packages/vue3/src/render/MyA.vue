<template>
  <div class="my-component">
    <h2>{{ msg }}</h2>
    <button @click="handleClick">Click Me!</button>
    <p v-if="clicked">Button was clicked!</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// 定义 props 类型
defineProps<{
  msg: string;
}>();

// 定义响应式变量
const clicked = ref(false);

// 定义方法
function handleClick() {
  clicked.value = true;
}
</script>

<style scoped>
.my-component {
  border: 1px solid #ccc;
  padding: 16px;
  border-radius: 8px;
}
.my-component h2 {
  color: #42b983;
}
.my-component button {
  margin-top: 10px;
}
</style>