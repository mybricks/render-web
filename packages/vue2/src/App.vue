<template>
  <Render v-bind="this.$props"/>
</template>
<script>
import Render from "./components/Render.vue"

export default {
  components: {
    Render
  },
  props: {
    json: {
      type: Object
    },
    opts: {
      type: Object
    }
  },
};

</script>

