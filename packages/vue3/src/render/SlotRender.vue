<template>
  <RenderSlot v-bind="mProps"/>
</template>
<!-- <RenderSlot v-bind="mProps"/> -->

<script setup lang="ts">
const { ref, watch, onBeforeUnmount } = window.Vue
import { uuid } from "../../../core/utils";
import RenderSlot from "./RenderSlot.vue";
const props1 = defineProps<{
  // key={params?.key} // 这里需要在Slotrender里面重新计算
  props?,
  // currentScope={currentScope}  // 这里需要在Slotrender里面重新计算
  slotId?,
  slot?,
  params?,
  style?,
  onError?,
  createPortal?,
  parentComId?,
  logger?,
  env?,
  _env?,
  scope?,
  getComDef?,
  context?,
  options?,
}>();
const {
  slotId,
  parentComId,
  props,
  // currentScope,
  slot,
  params,
  scope,
  env,
  createPortal,
  _env,
  style,
  getComDef,
  context,
  onError,
  logger,
  options
} = props1;

let currentScope = props1.currentScope;

const paramsScope = params?.scope
if (paramsScope) {
  currentScope = {
    id: paramsScope.id + '-' + paramsScope.frameId,
    frameId: slotId,
    parentComId: id,
    parent: paramsScope
  }
}

const preInputValues = ref(null)

const init = () => {
  const isRuntime = !env.edit
  let finalScope = currentScope
  let finalProps = props
  let hasNewScope = false

  if (!finalScope) {
    if (slot?.type === 'scope') {
      finalScope = {
        id: uuid(10, 16),
        frameId: slotId,
        parentComId
      }

      hasNewScope = true
    }
  }

  if (params) {
    const ivs = params.inputValues
    if (typeof ivs === 'object') {
      if (hasNewScope) {
        finalProps = context.get({comId: parentComId, slotId, scope: finalScope})
      } else {
        finalScope = {...finalScope, id: finalScope.id + '-' + uuid(10, 16), parentScope: finalScope}
        finalProps = context.get({comId: parentComId, slotId, scope: finalScope})
      }

      if (isRuntime) {
        finalProps.setSlotValue(ivs)
        for (let pro in ivs) {
          finalProps.inputs[pro](ivs[pro], finalScope)
        }
      }
    }
  }
  finalProps.run(finalScope)

  return { curScope: finalScope, curProps: finalProps, isRuntime }
}

const { curScope, curProps, isRuntime } = init()

// import { onBeforeUnmount } from "vue";

watch(() => params?.inputValues, () => {
  if (isRuntime) {
    const paramsInputValues = params?.inputValues
    if (paramsInputValues) {
      if (!preInputValues.value) {
        preInputValues.value = paramsInputValues
        curProps.run(null, true)
      } else if (typeof paramsInputValues === 'object' && (JSON.stringify(preInputValues.value) !== JSON.stringify(paramsInputValues))) {
        preInputValues.value = paramsInputValues
        curProps.setSlotValue(paramsInputValues)
        for (let pro in paramsInputValues) {
          curProps.inputs[pro](paramsInputValues[pro], curScope)
        }
        curProps.run()
      }
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  curProps.destroy()
})

const mProps = {
  scope:curScope,
  env,
  createPortal,
  _env,
  slot,
  params,
  wrapper: params?.wrap,
  template: params?.itemWrap,
  getComDef,
  context,
  inputs: params?.inputs,
  outputs: params?.outputs,
  _inputs: params?._inputs,
  _outputs: params?._outputs,
  onError,
  logger,
  options,
}

</script>

<style scoped>

</style>