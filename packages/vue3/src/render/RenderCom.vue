<template>
  <div
    :id="id"
    :key="id"
    :data-title="title"
    :data-namespace="def.namespace"
    :data-nested-id="rootId ? `${rootId}-${id}` : id"
    :class="getContainerClass(classes)"
    :style="divStyle"
  >
    <component :is="ComponentRuntime" v-bind="ComponentProps">
      <template :key="templateSlot.slotId" v-for="templateSlot in templateSlots" v-slot:[templateSlot.slotId]="slotProps">
        <SlotRender v-bind="{...templateSlot, params: slotProps}"/>
      </template>
    </component>
   
  </div>
</template>

<script setup lang="ts">
// import { Button } from 'ant-design-vue'
// import Button from "/Users/lianglihao/Documents/GitHub/comlib-pc-vue3/src/button/runtime.vue"
// import { ref, inject, useCssModule } from 'vue';
const { ref, inject, useCssModule } = window.Vue
defineOptions({
  inheritAttrs: false,
});
import { ModuleContext } from './context';
import {isNumber, uuid, pxToRem, pxToVw, convertCamelToHyphen, getStylesheetMountNode} from "../../../core/utils";
import SlotRender from "./SlotRender.vue"
// const css = useCssModule()
// 定义 props 类型
const props = defineProps<{
  com?,
  index?,
  getComDef?,
  context?,
  scope?,
  props?,
  env?,
  _env?,
  template?,
  onError?,
  logger?,
  createPortal?,
  options?,
}>();
const {
  com,
  index,
  getComDef,
  context,
  scope,
  props: parentProps,
  env,
  _env,
  template,
  onError,
  logger,
  createPortal,
  options
} = props;
const {id, def, name, slots = {}, dynamicId} = com
const {
  data,
  title,
  style,
  inputs: myInputs,
  outputs: myOutputs,
  _inputs: _myInputs,
  _outputs: _myOutputs,
  _notifyBindings: _myNotifyBindings
} = parentProps
const { rootId } = options

const _moduleContext = inject(ModuleContext);

function getStyleAry ({ env, style, def }) {
  const comThemes = env?.themes?.comThemes

  if (!comThemes) {
    return style.styleAry
  }

  let styleAry = style.styleAry

  const { themesId } = style
  const { namespace } = def

  if (!themesId) {
    // 没有themesId，查找默认值
    const comThemeAry = comThemes[namespace]
    if (Array.isArray(comThemeAry)) {
      const comTheme = comThemeAry.find(({ isDefault }) => isDefault)
      if (comTheme) {
        styleAry = comTheme.styleAry
      }
    }
  } else if (themesId === '_defined') {
    // 说明用户修改过风格化样式，读当前styleAry即可
  } else {
    // 根据themesId查找相应的内容
    const comThemeAry = comThemes[namespace]
    if (Array.isArray(comThemeAry)) {
      const comTheme = comThemeAry.find(({ id }) => id === themesId)
      if (comTheme) {
        styleAry = comTheme.styleAry
      }
    }
  }

  return styleAry
}

const init = () => {
  const { handlePxToVw, debug, disableStyleInjection, rootId, stylization } = options
    const styleId = rootId ? `${rootId}-${id}` : id;
    if (!disableStyleInjection && !stylization.hasDefaultStyle(styleId)) {
      stylization.setDefaultStyle(styleId);
      const styleAry = getStyleAry({ env, def, style })

      if (Array.isArray(styleAry)) {
        stylization.setStyle(styleId, styleAry);
      }
      Reflect.deleteProperty(style, 'styleAry')
      Reflect.deleteProperty(style, 'themesId')
    }
}

init();

const comDef = getComDef(def)

const templateSlots = []
// TODO:插槽
const propsSlots = {}
if (com.slots) {
  Object.entries(com.slots).forEach(([slotId, slot]) => {

    let currentScope;

    if (scope) {
      currentScope = {
        id: scope.id + '-' + scope.frameId + `${dynamicId ? '-' + dynamicId : ''}`,
        frameId: slotId,
        parentComId: id,
        parent: scope,
        dynamicId
      }
    }

    // const props = context.get({comId: id, slotId, scope})
    const props = context.get({comId: id, slotId, slot, scope: currentScope})

    propsSlots[slotId] = {
      get size() {
        return slot?.comAry?.length || 0
      }
    }
    
    templateSlots.push({
      // key={params?.key} // 这里需要在Slotrender里面重新计算
      props,
      currentScope,
      slotId,
      slot,
      // params,
      style,
      onError,
      createPortal,
      parentComId: id,
      logger,
      env,
      _env,
      scope,
      getComDef,
      context,
      options,
      // slotId,
      // propsSlot: slot,
      // // params 入参数 { inputValues }
      // props,
      // propsStyle: style,
      // onError,
      // // createPortal
      // logger,
      // env,
      // _env,
      // scope,
      // getComDef,
      // context
    })
  })
}

const getParentSlot = () => {
  if (props.frameId && props.parentComId) {
      let finalScope = scope?.parentScope || scope
      const slotProps = context.get({comId: props.parentComId, slotId: props.frameId, scope: finalScope?.parent ? finalScope : null})
      if (slotProps) {
        return {
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
}

const parentSlot = getParentSlot()
const getContainerClass = (css) => {
  return getClasses({style, id, rootId}, css)
}
function addPx (value) {
  return value + (isNumber(value) ? "px": "")
}
function getClasses({style, id, rootId}, css) {
  // const classes = [rootId ? `${rootId}-${id}` : id, css.com]
  const classes = [id, css.com]

  // 临时兼容
  // style._new 说明是新数据结构，不再需要css.flex
  if (style.flex === 1 && !style._new) {
    classes.push(css.flex)
  }

  if (style.heightAuto) {
    classes.push(css.comHeightAuto)
  }
  // 暂时去除，应该没有这个属性了
  // if (style.flex === 1) {
  //   classes.push(css.flex)
  // }

  return classes.join(" ")
}
function getSizeStyle({style}) {
  const sizeStyle: any = {}
  const {width, height, maxWidth, flexX, minWidth, minHeight, rotation} = style

  if (!width && !flexX) {
    // sizeStyle.width = "100%"
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

  if (maxWidth) {
    sizeStyle.maxWidth = addPx(maxWidth)
  }

  if (minWidth) {
    sizeStyle.minWidth = addPx(minWidth)
  }

  if (minHeight) {
    sizeStyle.minHeight = addPx(minHeight)
  }

  if (isNumber(rotation)) {
    sizeStyle.transform = `rotate(${rotation}deg)`;
    sizeStyle.transformOrigin = 'center center';
  }

  return sizeStyle
}
function getMarginStyle({style}) {
  const {
    margin, // TODO: 这里智能布局为了方便用到margin，后面看去掉
    marginTop,
    marginLeft,
    marginRight,
    marginBottom,
    paddingTop,
    paddingLeft,
    paddingRight,
    paddingBottom
  } = style

  if (margin) {
    return {
      margin
    }
  }

  return {
    marginTop: addPx(marginTop),
    marginLeft: addPx(marginLeft),
    marginRight: addPx(marginRight),
    marginBottom: addPx(marginBottom),
    paddingTop: addPx(paddingTop),
    paddingLeft: addPx(paddingLeft),
    paddingRight: addPx(paddingRight),
    paddingBottom: addPx(paddingBottom)
  }
}

// const classes = getClasses({style, id, rootId})
const sizeStyle = getSizeStyle({style})
const marginStyle = getMarginStyle({style})

const otherStyle: any = {
    zIndex: style.zIndex
  }

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
    // otherStyle.zIndex = 10 // 这里再观察一下，目前设置1是和引擎保持一致的
    otherStyle.zIndex = 1
  }
}

// const ContainerProps = {
//   id,
//   // id={rootId ? `${rootId}_${id}` : id}
//   key: id,
//   "data-title": title,
//   'data-namespace': def.namespace,
//   'data-nested-id': rootId ? `${rootId}-${id}` : id,
//   // style: {
//   //   display: style.display,
//   //   visibility: style.visibility,
//   //   // overflow: "hidden",
//   //   // position: style.position || "relative",
//   //   position: style.position,
//   //   flex: style.flex,
//   //   flexDirection: style.flexDirection,
//   //   flexShrink: style.flexShrink,
//   //   ...otherStyle,
//   //   ...sizeStyle,
//   //   ...marginStyle,
//   //   ...(style.ext || {})
//   // }
// }

const divStyle = {
  display: style.display,
  visibility: style.visibility,
  // overflow: "hidden",
  // position: style.position || "relative",
  position: style.position,
  flex: style.flex,
  flexDirection: style.flexDirection,
  flexShrink: style.flexShrink,
  ...otherStyle,
  ...sizeStyle,
  ...marginStyle,
  ...(style.ext || {})
}

// console.log("divStyle: ", divStyle)

// const a = {
//     display: style.display,
//     visibility: style.visibility,
//     // overflow: "hidden",
//     // position: style.position || "relative",
//     position: style.position,
//     flex: style.flex,
//     flexDirection: style.flexDirection,
//     flexShrink: style.flexShrink,
//     ...otherStyle,
//     ...sizeStyle,
//     ...marginStyle,
//     ...(style.ext || {})
//   }
//   if (a.zIndex === 4) {
//     console.log("aaaaaa: ", a, title)
//   }

// const ContainerClass = classes

const ComponentRuntime = comDef.runtime

let ComponentProps = {
  id: dynamicId || id,
  _id: rootId ? `${rootId}-${id}` : id,
  env,
  _env,
  data,
  name,
  title,
  style,
  inputs: myInputs,
  outputs: myOutputs,
  _inputs: _myInputs,
  _outputs: _myOutputs,
  _notifyBindings: _myNotifyBindings,
  // slots={slotsProxy}
  createPortal: createPortal,
  parentSlot: parentSlot,
  onError: onError,
  logger: logger,
  _onError_: (e) => {
    throw new Error(e)
  },
  // modules={_moduleContext.modules}
}

ComponentProps = {
  ...ComponentProps,
  m: {
    ...ComponentProps,
    style
  }
}


</script>

<style lang="less" module="classes">
.com {
  flex-shrink: 0;
  // z-index: 1; // 自由定位和排版布局组件的层级关系问题 - 
  min-height: 0; // 解决flex布局下组件溢出问题，https://test.mybricks.world/mybricks-app-pc-cdm/index.html?id=539820299853893
}

.comHeightAuto {
  & > div {
    flex: 1
  }
}


.flex {
  flex: 1;
  min-height: 0;
  // 兼容ios wrap元素塌陷问题
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