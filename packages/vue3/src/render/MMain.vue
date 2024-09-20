<template>
  <RenderSlot
    v-bind="mProps"
  />
</template>

<script setup lang="ts">
// import { ref, provide, inject, watchEffect } from 'vue';
const { ref, provide, inject, watchEffect } = window.Vue
import executor, { Var } from '../../../core/executor'
import { MyBricksRenderContext as MRContext, ModuleContext as MContext } from './context';
import RenderSlot from './RenderSlot.vue';

// {json, options, style = {}, className = '', root = true, from
const props = defineProps<{
  json?,
  options?,
  style?,
  className?,
  root?,
  from?,
  ModuleContext?,
  MyBricksRenderContext?
}>()

let _context;
let _moduleContext;

if (props.MyBricksRenderContext) {
  provide(MRContext, props.MyBricksRenderContext)
  _context = props.MyBricksRenderContext
} else {
  _context = inject(MRContext)
}
if (props.ModuleContext) {
  provide(MContext, props.ModuleContext)
  _moduleContext = props.ModuleContext
} else {
  _moduleContext = inject(MContext)
}

const { json, options, style = {}, className = '', root = true, from } = props;

const init = () => {
  const { debug } = options

  const { env } = _moduleContext;
  const slot = json.slot
  if (!env.canvas.isValid && !options._isNestedRender && debug && from === 'scene' && slot && slot.type !== "module" && slot.showType !== "module") {
    /**
      * 1. 调试模式
      * 2. 场景（页面）
      * 3. 非模块
      */
    // style.minHeight = slot.style.height;
    style.flex = 1
  }

  if (slot?.showType === "module" || slot?.type === "module") {
    /** 做为组件使用的场景 - 目前是云组件出码，引擎配置showType: "module" */
    const { style: slotStyle } = slot;

    // eslint-disable-next-line no-prototype-builtins
    if (!style.hasOwnProperty('height')) {
      if (slotStyle.heightAuto) {
        style.height = "fit-content"
      } else if (slotStyle.heightFull) {
        style.height = "100%"
      } else {
        style.height = slotStyle.height
      }
    }

    // eslint-disable-next-line no-prototype-builtins
    if (!style.hasOwnProperty('width')) {
      if (slotStyle.widthAuto) {
        style.width = "fit-content"
      } else if (slotStyle.widthFull) {
        style.width = "100%"
      } else {
        style.width = slotStyle.width
      }
    }

    slot.style.backgroundColor = slot.style.backgroundColor || "#ffffff00";
  }

  if (json.type === "module") {
    // 修复模块调试时默认白色背景问题
    slot.style.backgroundColor = slot.style.backgroundColor || "#ffffff00";
  }

  if (_context._v === "2024-diff") {
    json._v = _context._v
  }

  return {
    env,
    onError: _context.onError,
    logger: _context.logger,
    getComDef: (def: any) => _context.getComDef(def),
    slot,
    _context
  }
}

const { env, onError, logger, slot, getComDef } = init()

const init2 = () => {
  try {
      let refs
      let activeTriggerInput = true
      const context = executor({
        json,
        getComDef,
        events: options.events,
        env,
        ref(_refs: any) {
          refs = _refs
          if (typeof options.ref === 'function') {
            options.ref(_refs)
            // 如果被代理，那么inputs由外部处理
            activeTriggerInput = false
          }
        },
        onError,
        debug: options.debug,
        debugLogger: options.debugLogger,
        logger,
        scenesOperate: options.scenesOperate,
        _isNestedRender: options._isNestedRender,
        _isNestCom: options._isNestCom,
        _context,
        rootId: options.rootId
      }, {//////TODO goon
        observable: _context.observable
      })

      // context.styleMap = {}

      return [context, refs, activeTriggerInput]
    } catch (ex: any) {
      console.error(ex);
      Notification.error(`导出的JSON.script执行异常: ${ex?.stack || ex?.message || ex?.toString?.()}`);
      throw new Error(`导出的JSON.script执行异常.`)
    }
}

const [context, refs, activeTriggerInput] = init2()


watchEffect(() => {
  if (!options.disableAutoRun) {
    if (activeTriggerInput) {
      const { inputs } = refs
      const jsonInputs = json.inputs
      if (inputs && Array.isArray(jsonInputs)) {
        jsonInputs.forEach((input) => {
          const { id, mockData, type, extValues } = input
          let value = void 0
          if (options.debug) {
            if (type === "config" && extValues?.config && "defaultValue" in extValues.config) {
              try {
                value = JSON.parse(decodeURIComponent(extValues.config.defaultValue))
              } catch {
                value = extValues.config.defaultValue
              }
            } else {
              try {
                value = JSON.parse(decodeURIComponent(mockData))
              } catch {
                value = mockData
              }
            }
          }
          inputs[id](value)
        })
      }
    }
    refs.run()
  }
}, {
  flush: "post"
})

const mProps = {
  env,
  style,
  _env: options._env,
  slot,
  getComDef,
  context,
  className,
  createPortal: options.createPortal || (() => {}),
  onError,
  logger,
  root,
  options,
  ...(json.type === "module" ? { // 模块添加画布的点击事件
    onClick() {
      options.outputs?.["click"]();
    }
  } : {}),
}

</script>

<style scoped>

</style>