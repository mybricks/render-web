<template>
  <RenderSlot v-if="hasUi" v-bind="props" />  
</template>

<script>
import Vue from 'vue'
import coreLib from '@mybricks/comlib-core'
import executor from '../../../core/executor'
import RenderSlot from './RenderSlot.vue'

export default {
  components: {
    RenderSlot
  },
  props: {
    json: {
      type: Object,
    },
    opts: {
      type: Object
    },
    propsStyle: {
      type: Object,
    },
    className: {
      type: String
    }
  },
  created() {
    const { json, opts } = this.$props

    this.hasUi = json.rtType !== 'js'

    let comDefs = {}

    if (opts.comDefs) {
      Object.assign(comDefs, opts.comDefs)
    }

    /** 默认从window上查找组件库 */
    let comLibs = [...(window["__comlibs_edit_"] || []), ...(window["__comlibs_rt_"] || [])]

    /** 插入核心组件库(fn,var等) */
    comLibs.push(coreLib)
    comLibs.forEach(lib => {
      const comAray = lib.comAray;
      if (comAray && Array.isArray(comAray)) {
        this.regAry(comAray, comDefs)
      }
    })

    this.comDefs = comDefs

    try {
      let refs
      let activeTriggerInput = true
      const context = executor({
        json,
        getComDef: this.getComDef,
        events: opts.events,
        env: opts.env,
        ref(_refs) {
          refs = _refs
          if (typeof opts.ref === 'function') {
            opts.ref(_refs)
            // 如果被代理，那么inputs由外部处理
            activeTriggerInput = false
          }
        },
        onError: this.onError,
        debug: opts.debug,
        debugLogger: opts.debugLogger,
        logger: this.logger,
        scenesOperate: opts.scenesOperate
      }, {//////TODO goon
        observable: opts.observable || Vue.observable //传递获取响应式的方法
      })

      this.context = context
      this.refs = refs
      this.activeTriggerInput = activeTriggerInput
    } catch (ex) {
      console.error(ex);
      throw new Error(`导出的JSON.script执行异常.`)
    }

  },
  mounted() {
    const { opts, json } = this.$props
    if (!opts.disableAutoRun) {
      if (this.activeTriggerInput) {
        const { inputs } = this.refs
        const jsonInputs = json.inputs
        if (inputs && Array.isArray(jsonInputs)) {
          jsonInputs.forEach((input) => {
            const { id, mockData } = input
            let value = void 0
            // 这里应该不需要，不会在用于引擎
            if (opts.debug && typeof mockData !== 'undefined') {
              try {
                value = JSON.parse(decodeURIComponent(mockData))
              } catch {
                value = mockData
              }
            }
            inputs[id](value)
          })
        }
      }
      refs.run()
    }
  },
  computed: {
    logger() {
      return {
        ...console
      }
    },
    onError() {
      return (e) => {
        console.error(e)
      }
    },
    props() {
      const { json, opts, propsStyle, className } = this.$props

      return {
        env: opts.env,
        propsStyle,
        _env: opts._env,
        registSpm: opts.registSpm,
        propsSlot: json.slot,
        getComDef: this.getComDef,
        context: this.context,
        className,
        onError: this.onError,
        logger: this.logger,
        root: true,
          // __rxui_child__={!opts.observable}
          // createPortal={opts.createPortal || (() => {})}
      }
    }
  },
  methods: {
    regAry(comAray, comDefs) {
      comAray.forEach(comDef => {
        if (comDef.comAray) {
          this.regAry(comDef.comAray, comDefs);
        } else {
          comDefs[`${comDef.namespace}-${comDef.version}`] = comDef;
        }
      })
    },
    getComDef(def) {
      const { comDefs } = this
      const rtn = comDefs[def.namespace + '-' + def.version]
      if (!rtn) {
        const ary = []
        for (let ns in comDefs) {
          if (ns.startsWith(def.namespace + '-')) {
            ary.push(comDefs[ns])
          }
        }

        if (ary && ary.length > 0) {
          ary.sort((a, b) => {
            return compareVersion(a.version, b.version)
          })

          const rtn0 = ary[0]
          console.warn(`【Mybricks】组件${def.namespace + '@' + def.version}未找到，使用${rtn0.namespace}@${rtn0.version}代替.`)

          return rtn0
        } else {
          console.log(comDefs)

          throw new Error(`组件${def.namespace + '@' + def.version}未找到，请确定是否存在该组件以及对应的版本号.`)
        }
      }
      return rtn
    },
  }
}
</script>