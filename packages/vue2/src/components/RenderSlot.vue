<template>
  <div data-isslot='1' :class="classes" :style="styles">
    <component v-for="com in comAry" :key="com.id" :is="com.component" v-bind="com.props" />
    
    <div></div>
  </div>
</template>

<script>
import RenderCom from './RenderCom.vue'

export default {
  props: {
    env: {
      type: Object
    },
    propsStyle: {
      type: Object
    },
    _env: {
      type: Object
    },
    propsSlot: {
      type: Object
    },
    getComDef: {
      type: Function
    },
    registSpm: {
      type: Function
    },
    context: {
      type: Object
    },
    className: {
      type: String
    },
    onError: {
      type: Function
    },
    logger: {
      type: Object
    },
    root: {
      type: Boolean
    },
    scope: {
      type: Object
    },
    inputs: {
      type: Object
    },
    outputs: {
      type: Object
    },
    _inputs: {
      type: Object
    },
    _outputs: {
      type: Object
    },
    params: {
      type: Object
    }
  },
  created() {

  },
  computed: {
    comAry() {
      const { env, _env, propsSlot, context, getComDef, registSpm, onError, logger, scope, inputs, _inputs, outputs, _outputs } = this.$props
      const { comAry } = propsSlot
      const itemAry = []

      comAry.forEach((com, idx) => {//组件逐个渲染
        const {id, def, name} = com
        const comInfo = context.getComInfo(id)
        const { hasPermission } = env
        const permissions = comInfo?.model?.permissions

        if (permissions && typeof hasPermission === 'function' && !hasPermission(permissions.id)) {
          return
        }
        const comDef = getComDef(def)

        if (comDef) {
          const props = context.get(id, scope, {
            inputs, outputs, _inputs, _outputs
          })

          const comKey = (scope ? scope.id : '') + idx//考虑到scope变化的情况，驱动组件强制刷新

          itemAry.push({
            id,
            props: {
              key: comKey,
              com,
              getComDef,
              registSpm,
              context,
              scope,
              props,
              env,
              _env,
              // template
              onError,
              logger,
              // createPortal
              // __rxui_child__
            },
            component: RenderCom,
            name,
            inputs: props.inputsCallable,
            style: props.style
          })
        } else {
          console.error(`组件 (namespace = {${def.namespace}}）未找到.`)
        }
      })

      return itemAry
    },
    classes() {
      const { root, className, params, propsStyle } = this.$props

      const paramsStyle = params?.style || params?._style;
      const slotStyle = paramsStyle || propsStyle;

      return `${this.calSlotClasses(slotStyle || {})}${root && className ? ` ${className}` : ''}`
    },
    styles() {
      const { root, propsStyle, params } = this.$props

      const paramsStyle = params?.style || params?._style;
      const slotStyle = paramsStyle || propsStyle;

      return {...this.calSlotStyles(slotStyle || {}, !!paramsStyle, root), ...propsStyle}
    }
  },
  methods: {
    calSlotStyles(style, hasParamsStyle, root) {
      // 兼容旧的style
      const {
        paddingLeft,
        paddingTop,
        paddingRight,
        paddingBottom,
        background,
        backgroundColor,
        backgroundImage,
        backgroundPosition,
        backgroundRepeat,
        backgroundSize,
        ...otherStyle
      } = style;
      let slotStyle = {
        paddingLeft: paddingLeft || 0,
        paddingTop: paddingTop || 0,
        paddingRight: paddingRight || 0,
        paddingBottom: paddingBottom || 0,
        //height: style.customHeight || '100%'
        // backgroundColor: backgroundColor || (root ? '#ffffff' : void 0), // TODO
        backgroundColor,
        backgroundImage,
        backgroundPosition,
        backgroundRepeat,
        backgroundSize,
      }
      // 兼容旧的style
      if (background) {
        const isOldBackground = typeof background === 'object'
        if (isOldBackground) {
          const {
            background: bg,
            backgroundImage,
            backgroundColor,
            backgroundRepeat,
            backgroundSize
          } = background;
      
          slotStyle.backgroundRepeat = backgroundRepeat
          slotStyle.backgroundSize = backgroundSize
      
          if (bg) {
            slotStyle.background = bg
          } else {
            slotStyle.backgroundImage = backgroundImage
            slotStyle.backgroundColor = backgroundColor
          }
        } else {
          slotStyle.background = background
        }
      }

      if (hasParamsStyle) {
        slotStyle = Object.assign(slotStyle, otherStyle)
      }

      return slotStyle
    },
    calSlotClasses(slotStyle) {
      const moduleStyle = this.$style
      const rtn = [moduleStyle.slot, 'slot']

      const style = slotStyle
        if (style) {
          if (style.layout?.toLowerCase() == 'flex-column') {
            rtn.push(moduleStyle.lyFlexColumn)
          } else if (style.layout?.toLowerCase() == 'flex-row') {
            rtn.push(moduleStyle.lyFlexRow)
          }

          const justifyContent = style.justifyContent
          if (justifyContent) {
            if (justifyContent.toUpperCase() === 'FLEX-START') {
              rtn.push(moduleStyle.justifyContentFlexStart)
            } else if (justifyContent.toUpperCase() === 'CENTER') {
              rtn.push(moduleStyle.justifyContentFlexCenter)
            } else if (justifyContent.toUpperCase() === 'FLEX-END') {
              rtn.push(moduleStyle.justifyContentFlexFlexEnd)
            } else if (justifyContent.toUpperCase() === 'SPACE-AROUND') {
              rtn.push(moduleStyle.justifyContentFlexSpaceAround)
            } else if (justifyContent.toUpperCase() === 'SPACE-BETWEEN') {
              rtn.push(moduleStyle.justifyContentFlexSpaceBetween)
            }
          }

          const alignItems = style.alignItems
          if (alignItems) {
            if (alignItems.toUpperCase() === 'FLEX-START') {
              rtn.push(moduleStyle.alignItemsFlexStart)
            } else if (alignItems.toUpperCase() === 'CENTER') {
              rtn.push(moduleStyle.alignItemsFlexCenter)
            } else if (alignItems.toUpperCase() === 'FLEX-END') {
              rtn.push(moduleStyle.alignItemsFlexFlexEnd)
            }
          }
        }

        return rtn.join(' ')
    }
  }
}
</script>

<style module lang="less">

 .slot {
  width: 100%;
  height: 100% !important;
  position: relative;
}

.lyFlexColumn {
  display: flex;
  flex-direction: column;
}

.lyFlexRow {
  display: flex;
  flex-direction: row;
}

.justifyContentFlexStart {
  justify-content: flex-start;
}

.justifyContentFlexCenter {
  justify-content: center;
}

.justifyContentFlexFlexEnd {
  justify-content: flex-end;
}

.justifyContentFlexSpaceAround {
  justify-content: space-around;
}

.justifyContentFlexSpaceBetween {
  justify-content: space-between;
}

.alignItemsFlexStart {
  align-items: flex-start;
}

.alignItemsFlexCenter {
  align-items: center;
}

.alignItemsFlexFlexEnd {
  align-items: flex-end;
}

.debugFocus{
  outline: 1px dashed red;
  outline-offset: -3px;
}


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