<template>
  <div v-bind="containerProps" :class="containerClass">
    <component :is="component" v-bind="componentProps">
      <template v-for="templateSlot in templateSlots" v-slot:[templateSlot.slotId]="slotProps">
        <SlotRender v-bind="{...templateSlot, params: slotProps}"/>
      </template>
    </component>
  </div>
</template>

<script>
import SlotRender from './SlotRender.vue'
import Module from './Module.vue'
import { pxToVw, pxToRem, convertCamelToHyphen, isNumber } from '../../../core/utils'

export default {
  props: {
    // key: comKey,
    com: {
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
    scope: {
      type: Object
    },
    props: {
      type: Object
    },
    env: {
      type: Object
    },
    _env: {
      type: Object
    },
    onError: {
      type: Function
    },
    logger: {
      type: Object
    },
  },
  components: {
    SlotRender
  },
  created() {
    const { _env, env, com, props, getComDef, registSpm, onError, logger, context, scope } = this.$props

    const { pxToRem: configPxToRem, pxToVw: configPxToVw } = env
    const {id, def, name, slots = {}} = com
    const {
      data,
      title,
      style,
      inputs: myInputs,
      outputs: myOutputs,
      _inputs: _myInputs,
      _outputs: _myOutputs,
      _notifyBindings: _myNotifyBindings
    } = props

    const styleAry = this.getStyleAry({ env, def, style })

    if (Array.isArray(styleAry)) {
      const root = env?.shadowRoot || document.getElementById('_mybricks-geo-webview_')?.shadowRoot
      if (!(root || document).querySelector(`style[id="${id}"]`)) {
        const styleTag = document.createElement('style')
        let innerText = ''

        styleTag.id = id
        styleAry.forEach(({css, selector, global}) => {
          if (selector === ':root') {
            selector = '> *:first-child'
          }
          innerText = innerText + `
            ${global ? '' : `#${id} `}${selector.replace(/\{id\}/g, `${id}`)} {
              ${Object.keys(css).map(key => {
                let value = css[key]
                if (configPxToRem && typeof value === 'string' && value.indexOf('px') !== -1) {
                  value = pxToRem(value)
                } else if (configPxToVw && typeof value === 'string' && value.indexOf('px') !== -1) {
                  value = pxToVw(value)
                }
                return `${convertCamelToHyphen(key)}: ${value};`
              }).join('\n')}
            }
          `
        })
        styleTag.innerHTML = innerText
        if (root) {
          root.appendChild(styleTag)
        } else {
          document.head.appendChild(styleTag)
        }
      }
    }
    // TODO
    Reflect.deleteProperty(style, 'styleAry')
    Reflect.deleteProperty(style, 'themesId')


    const comDef = getComDef(def)

    const templateSlots = []

    const propsSlots = {}

    if (com.slots) {
      Object.entries(com.slots).forEach(([slotId, slot]) => {
        const props = context.get({comId: id, slotId, scope})

        propsSlots[slotId] = {
          get size() {
            return slot?.comAry?.length || 0
          }
        }
        
        templateSlots.push({
          slotId,
          propsSlot: slot,
          // params 入参数 { inputValues }
          props,
          propsStyle: style,
          onError,
          // createPortal
          logger,
          env,
          _env,
          scope,
          getComDef,
          context
        })
      })
    }

    this.templateSlots = templateSlots

    // TODO: Slot
    let parentSlot

    if (props.frameId && props.parentComId) {
      const slotProps = context.get({comId: props.parentComId, slotId: props.frameId, scope: scope?.parent})
      if (slotProps) {
        parentSlot = {
          get _inputs() {
            return new Proxy({}, {
              get(target, name) {
                const fn = slotProps._inputRegs[name]
                return fn
              }
            })
          }
        }
      }
    }


    const classes = this.getClasses({style, id})
    const sizeStyle = this.getSizeStyle({style, env})
    const marginStyle = this.getMarginStyle({style, env})

    const otherStyle = {}

    if (['fixed', 'absolute'].includes(style.position)) {
      const { top, left, right, bottom } = style
      if (top || isNumber(top)) {
        otherStyle.top = isNumber(top) ? top + 'px' : top
      }
      if (bottom || isNumber(bottom)) {
        otherStyle.bottom = isNumber(bottom) ? bottom + 'px' : bottom
      }
      if (left || isNumber(left)) {
        otherStyle.left = isNumber(left) ? left + 'px' : left
      }
      if (right || isNumber(right)) {
        otherStyle.right = isNumber(right) ? right + 'px' : right
      }
      if (style.position === 'fixed') {
        // --- 2023.3.22 只有固定布局才需要通过设置zIndex达到置顶效果，自由布局不需要设置zIndex，否则永远在最上层
        otherStyle.zIndex = 1000;
      } else if (style.position === 'absolute') {
        otherStyle.zIndex = 1
      }

      const { pxToVw: configPxToVw } = env
      if (configPxToVw) {
        if (typeof otherStyle.top === 'string' && otherStyle.top.indexOf('px') !== -1) {
          otherStyle.top = pxToVw(otherStyle.top)
        }
        if (typeof otherStyle.bottom === 'string' && otherStyle.bottom.indexOf('px') !== -1) {
          otherStyle.bottom = pxToVw(otherStyle.bottom)
        }
        if (typeof otherStyle.left === 'string' && otherStyle.left.indexOf('px') !== -1) {
          otherStyle.left = pxToVw(otherStyle.left)
        }
        if (typeof otherStyle.right === 'string' && otherStyle.right.indexOf('px') !== -1) {
          otherStyle.right = pxToVw(otherStyle.right)
        }
      }
    }

    if (def.namespace === "mybricks.core-comlib.module") {
      // 模块使用内置的
      this.component = Module
    } else {
      this.component = comDef.runtime
    }

    this.comDef = comDef

    this.containerProps = {
      id,
      key: id,
      style: {
        display: style.display,
        // overflow: "hidden",
        position: style.position || "relative",
        ...otherStyle,
        ...sizeStyle,
        ...marginStyle,
        ...(style.ext || {})
      },
      // className: classes
    }
    this.containerClass = classes

    // console.log('传入组件的style: ', style)

    const componentProps = {
      id,
      env: {
        ...env,
        pxToVw,
        spm: registSpm ? registSpm?.(id, { title, namespace: def.namespace }) : null,
      },
      _env,
      data,
      name,
      title,
      slots: propsSlots,
      propsStyle: style, // TODO: style是保留字段
      inputs: myInputs,
      outputs: myOutputs,
      _inputs: _myInputs,
      _outputs: _myOutputs,
      _notifyBindings: _myNotifyBindings,
      // slots: slotsProxy,
      // createPortal,
      parentSlot,
      // __rxui_child__,
      onError,
      logger,
    }

    this.componentProps = {
      ...componentProps,
      m: {
        ...componentProps,
        style
      }
    }
  },
  methods: {
    getStyleAry({ env, def, style }) {
      const comThemes = env?.themes?.comThemes

      if (!comThemes) {
        return style.styleAry
      }

      let styleAry

      const { themesId } = style
      const { namespace } = def

      if (!themesId) {
        // 去找默认值
        const comThemeAry = comThemes[namespace]
        if (Array.isArray(comThemeAry)) {
          const comTheme = comThemeAry.find(({ isDefault }) => isDefault)
          if (comTheme) {
            styleAry = comTheme.styleAry
          }
        }
      } else if (themesId === '_defined') {
        // 使用styleAry
        styleAry = style.styleAry
      } else {
        // 去找相应的内容
        const comThemeAry = comThemes[namespace]
        if (Array.isArray(comThemeAry)) {
          const comTheme = comThemeAry.find(({ id }) => id === themesId)
          if (comTheme) {
            styleAry = comTheme.styleAry
          }
        }
      }

      // TODO: 兼容
      if (!styleAry) {
        return style.styleAry
      }

      return styleAry
    },
    getClasses({style, id}) {
      // const classes = [id, css.com]

      // if (style.flex === 1) {
      //   classes.push(css.flex)
      // }
      const classes = [id, this.$style.com]

      if (style.flex === 1) {
        classes.push(this.$style.flex)
      }

      return classes.join(" ")
    },
    getSizeStyle({style, env}) {
      const sizeStyle = {}
      const {width, height} = style

      if (!width) {
        sizeStyle.width = "100%"
      } else if (isNumber(width)) {
        sizeStyle.width = width + "px"
      } else if (width) {
        sizeStyle.width = width
      }

      if (isNumber(height)) {
        sizeStyle.height = height + "px"
      } else if (height) {
        sizeStyle.height = height
      }

      const { pxToVw: configPxToVw } = env
      if (configPxToVw) {
        if (typeof sizeStyle.width === 'string' && sizeStyle.width.indexOf('px') !== -1) {
          sizeStyle.width = pxToVw(sizeStyle.width)
        }
        if (typeof sizeStyle.height === 'string' && sizeStyle.height.indexOf('px') !== -1) {
          sizeStyle.height = pxToVw(sizeStyle.height)
        }
      }

      return sizeStyle
    },
    getMarginStyle({style, env}) {
      const marginStyle = {}
      const {
        width,
        marginTop,
        marginLeft,
        marginRight,
        marginBottom
      } = style

      if (isNumber(marginTop)) {
        marginStyle.marginTop = marginTop + "px"
      }
      if (isNumber(marginLeft)) {
        if (typeof width === "number" || marginLeft < 0) {
          marginStyle.marginLeft = marginLeft + "px"
        } else {
          marginStyle.paddingLeft = marginLeft + "px"
        }
      }
      if (isNumber(marginRight)) {
        if (typeof width === "number" || marginRight < 0) {
          marginStyle.marginRight = marginRight + "px"
        } else {
          marginStyle.paddingRight = marginRight + "px"
        }
      }
      if (isNumber(marginBottom)) {
        marginStyle.marginBottom = marginBottom + "px"
      }

      const { pxToVw: configPxToVw } = env
      if (configPxToVw) {
        if (typeof marginStyle.marginTop === 'string' && marginStyle.marginTop.indexOf('px') !== -1) {
          marginStyle.marginTop = pxToVw(marginStyle.marginTop)
        }
        if (typeof marginStyle.marginLeft === 'string' && marginStyle.marginLeft.indexOf('px') !== -1) {
          marginStyle.marginLeft = pxToVw(marginStyle.marginLeft)
        }
        if (typeof marginStyle.marginRight === 'string' && marginStyle.marginRight.indexOf('px') !== -1) {
          marginStyle.marginRight = pxToVw(marginStyle.marginRight)
        }
        if (typeof marginStyle.marginBottom === 'string' && marginStyle.marginBottom.indexOf('px') !== -1) {
          marginStyle.marginBottom = pxToVw(marginStyle.marginBottom)
        }
        if (typeof marginStyle.paddingLeft === 'string' && marginStyle.paddingLeft.indexOf('px') !== -1) {
          marginStyle.paddingLeft = pxToVw(marginStyle.paddingLeft)
        }
        if (typeof marginStyle.paddingRight === 'string' && marginStyle.paddingRight.indexOf('px') !== -1) {
          marginStyle.paddingRight = pxToVw(marginStyle.paddingRight)
        }
      }

      return marginStyle
    },
    getSlotProps() {
    }
  }
}
</script>

<style module>
.com {
  flex-shrink: 0;
   /* z-index: 1; */
}

.flex {
  flex: 1;
  min-height: 0;
   /* 兼容ios wrap元素塌陷问题 */
  position: relative;
  & > div {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
  }
  > * {
    height: 100%;
  }
}
</style>