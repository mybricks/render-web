<template>
  <div
    v-if="elements"
    :id='id'
    :key='id'
    :style="getStyle()"
  >
    <RenderSmart2
      :elements="elements"
    />
  </div>
  <component
    v-else
    :is="jsx"
    v-bind="jsxProps"
  />
</template>

<script setup lang="ts">
import HintLink from './HintLink.vue';
import ComponentNotFound from "./ComponentNotFound.vue";
import RenderCom from './RenderCom.vue';
import RenderSmart2 from './RenderSmart2.vue';

const props = defineProps<{
  com?, 
  index?, 
  env?, 
  getComDef?, 
  context?, 
  scope?, 
  inputs?, 
  outputs?, 
  _inputs?, 
  _outputs?, 
  _env?, 
  template?, 
  onError?, 
  logger?, 
  createPortal?, 
  options?,
}>()
const {com, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options} = props;
const { id, style } = com

const elements = com.elements?.map((com) => {
  return {com, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options}
})
// console.log('elements: ', elements)

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

const getStyle = () => {
  let finalStyle
  const { handlePxToVw } = options
  if (handlePxToVw) {
    finalStyle = {}
    Object.entries(style).forEach(([key, value]) => {
      const valueType = typeof value
      if ((valueType === 'string' && value.indexOf('px') !== -1)) {
        finalStyle[key] = handlePxToVw(value)
      } else if (valueType === 'number') {
        finalStyle[key] = handlePxToVw(`${value}px`)
      } else {
        finalStyle[key] = value
      }
    })
  } else {
    finalStyle = style
  }
  // console.log("finalStyle: ", finalStyle)
  return finalStyle
}

let jsx;
let jsxProps;

if (!elements) {
  const comJsx = getRenderComJSX({ com, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, index, _env, template, onError, logger, createPortal, options })
  jsx = comJsx.jsx
  jsxProps = comJsx.props
}

</script>
