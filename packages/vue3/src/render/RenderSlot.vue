<template>
  <div
    v-if="slot.style.layout === 'smart' && layoutTemplate"
    :data-isslot='1'
    :data-slot-id='slot.id'
    :onclick="onClick"
    :class="getClassName(classes, 'smart')"
    :style="getStyle('smart')"
  >
    <RenderSmart
      v-for="props in layoutTemplate"
      :key="props.index"
      v-bind="props"
    />
  </div>
  <div
    v-else
    :data-isslot='1'
    :data-slot-id='slot.id'
    :onclick="onClick"
    :class="getClassName(classes)"
    :style="getStyle()"
  >
    <component
      v-for="com in itemAry"
      :key="com.comkey"
      :is="com.jsx"
      v-bind="com.props"
    />
  </div>
</template>

<script setup lang="ts">
// import { ref, useCssModule } from 'vue';
const { ref, useCssModule } = window.Vue
// const css = useCssModule();
import HintLink from './HintLink.vue';
import ComponentNotFound from "./ComponentNotFound.vue";
import RenderCom from './RenderCom.vue';
import RenderSmart from './RenderSmart.vue';

// 定义 props 类型
const props = defineProps<{
  scope?,
  root?,
  slot?,
  style?,
  createPortal?,
  className?,
  params?,
  inputs?,
  outputs?,
  _inputs?,
  _outputs?,
  wrapper?,
  template?,
  env?,
  _env?,
  getComDef?,
  context?,
  onError?,
  logger?,
  options?,
  onClick?,
}>();

const {
  scope,
  root,
  slot,
  style: propsStyle = {},
  createPortal,
  className,
  params,
  inputs,
  outputs,
  _inputs,
  _outputs,
  wrapper,
  template,
  env,
  _env,
  getComDef,
  context,
  onError,
  logger,
  options,
  onClick
} = props

const getRenderComJSX = ({ com, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, index, _env, template, onError, logger, createPortal, options }) => {
  const {id, def, name, child, brother, dynamicId} = com
  const comInfo = context.getComInfo(id)
  const { hasPermission, permissions: envPermissions } = env
  const permissionsId = comInfo?.model?.permissions?.id
  if (permissionsId && typeof hasPermission === 'function') {
    const permissionInfo = hasPermission(permissionsId)
    if (!permissionInfo || (typeof permissionInfo !== 'boolean' && !permissionInfo.permission)) {
      // 没有权限信息或权限信息里的permission为false
      const envPermissionInfo = envPermissions.find((p: any) => p.id === permissionsId)
      const type = permissionInfo?.type || envPermissionInfo?.register.noPrivilege
      if (type === 'hintLink') {
        return {
          id,
          name,
          jsx: HintLink,
          props: {
            href: permissionInfo?.hintLinkUrl || envPermissionInfo.hintLink,
            target: '_blank',
            style: {textDecoration: 'underline'},
            content: permissionInfo?.hintLinkTitle || envPermissionInfo.register.title,
          },
          style: {}
        }
      }
      return
    }
  }
  const comDef = getComDef(def)

  if (comDef) {
    const props = context.get({comId: id, dynamicId, scope: scope ? {
      ...scope,
      id: dynamicId ? scope.id + '-' + dynamicId : scope.id,
      dynamicId,
    } : null, _ioProxy: {
      inputs, outputs, _inputs, _outputs
    }})

    if (props) {
      const comKey = id + (scope ? scope.id : '') + index//考虑到scope变化的情况，驱动组件强制刷新
      return {
        id,
        comKey,
        jsx: RenderCom,
        props: {
          com,
          index,
          getComDef,
          context,
          scope,
          props,
          env,
          _env,
          template,
          onError,
          logger,
          createPortal,
          options
        },
        brother,
        child,
        name,
        inputs: props.inputsCallable,
        style: props.style,
        com
      }
    } else {
      return {
        id, 
        jsx: ComponentNotFound,
        props: {
          content: `未找到组件(${def.namespace}@${def.version} - ${id})定义.`
        },
        name,
        style: {}
      }
    }
  } else {
    return {
      id,
      jsx: ComponentNotFound,
      props: {
        content: `未找到组件(${def.namespace}@${def.version})定义.`
      },
      name, 
      style: {}
    }
  }
}

// TODO: 智能布局
let layoutTemplate;
const itemAry = []
if (slot.style.layout === "smart" && slot.layoutTemplate) {
  layoutTemplate = slot.layoutTemplate.map((rstTraverseElement, index) => {
    return {com: rstTraverseElement, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options}
  })
  // {layoutTemplate.map((rstTraverseElement: any, index: any) => {
  //         return renderRstTraverseCom2({com: rstTraverseElement, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options})
  //       })}
} else {
  slot.comAry.forEach((com, idx) => {//组件逐个渲染
    const jsx = getRenderComJSX({ com, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, index: idx, _env, template, onError, logger, createPortal, options })
    if (jsx) {
      itemAry.push(jsx)
    }
  })
}

const getClassName = (classes, layoutType) => {
  const { style } = slot;
  let slotStyle

  if (layoutType === "smart") {
    const { rowGap, layout, position, justifyContent, flexWrap, flexDirection, display, columnGap, alignItems, ...paramsStyle} = params?.style || {};
    slotStyle = Object.assign(paramsStyle || {}, style)
  } else {
    const paramsStyle = params?.style;
    slotStyle = Object.assign(slot.style, paramsStyle || {})
  }

  // TODO: 智能布局
  return `${calSlotClasses(slotStyle, classes)}${root && className ? ` ${className}` : ''}`
}

const getStyle = (layoutType) => {
  const { style } = slot;
  let paramsStyle;
  let slotStyle;
  if (layoutType === "smart") {
    const { rowGap, layout, position, justifyContent, flexWrap, flexDirection, display, columnGap, alignItems, ...other} = params?.style || {};
    paramsStyle = other
    slotStyle = Object.assign(paramsStyle || {}, style)
  } else {
    paramsStyle = params?.style;
    slotStyle = Object.assign(style, paramsStyle || {})
  }
  return {...calSlotStyles(slotStyle, !!paramsStyle || slot.type === "module", root, slot.type === "module", options), ...propsStyle}
}

function calSlotClasses(slotStyle, css) {
  const rtn = [css.slot, 'slot']

  const style = slotStyle
  if (style) {
    if (style.layout?.toLowerCase() == 'flex-column') {
      rtn.push(css.lyFlexColumn)
    } else if (style.layout?.toLowerCase() == 'flex-row') {
      rtn.push(css.lyFlexRow)
    }

    const justifyContent = style.justifyContent
    if (justifyContent) {
      if (justifyContent.toUpperCase() === 'FLEX-START') {
        rtn.push(css.justifyContentFlexStart)
      } else if (justifyContent.toUpperCase() === 'CENTER') {
        rtn.push(css.justifyContentFlexCenter)
      } else if (justifyContent.toUpperCase() === 'FLEX-END') {
        rtn.push(css.justifyContentFlexFlexEnd)
      } else if (justifyContent.toUpperCase() === 'SPACE-AROUND') {
        rtn.push(css.justifyContentFlexSpaceAround)
      } else if (justifyContent.toUpperCase() === 'SPACE-BETWEEN') {
        rtn.push(css.justifyContentFlexSpaceBetween)
      }
    }

    const alignItems = style.alignItems
    if (alignItems) {
      if (alignItems.toUpperCase() === 'FLEX-START') {
        rtn.push(css.alignItemsFlexStart)
      } else if (alignItems.toUpperCase() === 'CENTER') {
        rtn.push(css.alignItemsFlexCenter)
      } else if (alignItems.toUpperCase() === 'FLEX-END') {
        rtn.push(css.alignItemsFlexFlexEnd)
      }
    }
  }

  return rtn.join(' ')
}

function calSlotStyles(style, hasParamsStyle, root, isModule, options) {
  const { handlePxToVw } = options
  // isModule 模块特殊处理
  // isEdit 模块兼容编辑态和调试态
  // 兼容旧的style
  const {
    // display = 'inline-block', // marginTop 导致的父元素塌陷问题 - 设置inline-block带来新问题，父元素的font-size会影响到子元素
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
    position,
    rowGap,
    columnGap,
    borderBottomColor,
    borderBottomLeftRadius,
    borderBottomRightRadius,
    borderBottomStyle,
    borderBottomWidth,
    borderLeftColor,
    borderLeftStyle,
    borderLeftWidth,
    borderRightColor,
    borderRightStyle,
    borderRightWidth,
    borderTopColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderTopStyle,
    borderTopWidth,
    boxShadow,
    top,
    left,
    marginLeft,
    marginTop,
    marginRight,
    marginBottom,
    overflowX,
    overflowY,
    height,
    heightAuto,
    heightFull,
    width,
    widthAuto,
    widthFull,
    ...otherStyle
  } = style;
  let slotStyle = {
    // display,
    rowGap,
    columnGap,
    paddingLeft: paddingLeft || 0,
    paddingTop: paddingTop || 0,
    paddingRight: paddingRight || 0,
    paddingBottom: paddingBottom || 0,
    //height: style.customHeight || '100%'
    backgroundColor: backgroundColor || (root ? '#ffffff' : void 0),
    backgroundImage,
    backgroundPosition,
    backgroundRepeat,
    backgroundSize,
    borderBottomColor,
    borderBottomLeftRadius,
    borderBottomRightRadius,
    borderBottomStyle,
    borderBottomWidth,
    borderLeftColor,
    borderLeftStyle,
    borderLeftWidth,
    borderRightColor,
    borderRightStyle,
    borderRightWidth,
    borderTopColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderTopStyle,
    borderTopWidth,
    boxShadow,
    overflowX,
    overflowY,
  } as any
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

  // 这里还需要根据是否在智能布局环境下
  if (isModule) {
    // slotStyle.transform = 'scale(1)';
    if (heightAuto) {
      slotStyle.height = "fit-content"
    } else if (heightFull) {
      // if (isEdit) {
      //   slotStyle.height = style.height
      // } else {
      //   slotStyle.height = "100%"
      // }
      slotStyle.height = "100%"
    } else {
      slotStyle.height = height
    }

    if (widthAuto) {
      slotStyle.width = "fit-content"
    } else if (widthFull) {
      slotStyle.width = "100%"
      // if (isEdit) {
      //   slotStyle.width = style.width
      // } else {
      //   slotStyle.width = "100%"
      // }
    } else {
      slotStyle.width = width
    }
  }

  if (hasParamsStyle) {
    slotStyle = Object.assign(slotStyle, otherStyle)
  }

  if (handlePxToVw) {
    Object.entries(slotStyle).forEach(([key, value]) => {
      const valueType = typeof value
      if ((valueType === 'string' && value.indexOf('px') !== -1)) {
        slotStyle[key] = handlePxToVw(value)
      } else if (valueType === 'number') {
        slotStyle[key] = handlePxToVw(`${value}px`)
      } else {
        slotStyle[key] = value
      }
    })
  }

  return slotStyle
}

</script>

<style lang="less" module="classes">
.slot {
  width: 100%;
  // height: 100% !important;
  height: 100%; // 智能布局下，插槽可能是定高的
  // position: relative !important;
  position: relative;
}

.lyFlexColumn {
  display: flex;
  flex-direction: column;
}

.lyFlexRow {
  display: flex;
  flex-direction: row;
  // flex-wrap: wrap;
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