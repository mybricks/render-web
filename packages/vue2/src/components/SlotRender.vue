<template>
  <!-- <RenderSlot v-bind="slotProps"/> -->
  <component :is="slotComponent" v-bind="slotProps"/>
</template>

<script>
import RenderSlot from './RenderSlot.vue'
export default {
  props: {
    slotId: {
      type: String
    },
    propsSlot: {
      type: Object
    },
    params: {
      type: Object
    },
    props: {
      type: Object
    },
    propsStyle: {
      type: Object
    },
    onError: {
      type: Function
    },
    // createPortal
    logger: {
      type: Object
    },
    env: {
      type: Object
    },
    _env: {
      type: Object
    },
    scope: {
      type: Object
    },
    getComDef: {
      type: Function
    },
    context: {
      type: Object
    },
    // __rxui_child__
  },
  created() {
    let curScope
    const { propsSlot: slot, scope, props, env, _env, getComDef, context, onError, logger, params } = this.$props

    Object.assign(params, params.m)

    if (slot?.type === 'scope') {
      let nowScopeId = uuid(10, 16)

      curScope = {
        id: nowScopeId,
        frameId: slotId
      }

      if (scope) {
        curScope.parent = scope
      }
    } else {
      curScope = scope
    }

    let wrapFn

    // TODO: 入参 inputsValue
    if (params) {
      const ivs = params.inputValues
      if (typeof ivs === 'object') {
        for (let pro in ivs) {
          props.inputs[pro](ivs[pro], curScope)
        }
      }

      if (typeof params.wrap === 'function') {
        wrapFn = params.wrap
      }
    }

    props.run(curScope)

    this.slotProps = {
      scope: curScope,
      env,
      // createPortal={createPortal}
      _env,
      propsSlot: slot,
      params: params,
      // wrapper={wrapFn}
      // template={params?.itemWrap}
      getComDef,
      context,
      inputs: params?.inputs,
      outputs: params?.outputs,
      _inputs: params?._inputs,
      _outputs: params?._outputs,
      onError,
      logger,
      // __rxui_child__={__rxui_child__}
    }
    this.slotComponent = RenderSlot
  }
}
</script>