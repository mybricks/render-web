/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {isNumber, uuid, pxToRem, pxToVw, convertCamelToHyphen, getStylesheetMountNode} from "../../core/utils";

import lazyCss from "./RenderSlot.lazy.less";
import ErrorBoundary from "./ErrorBoundary";

const css = lazyCss.locals

function renderRstTraverseCom2({com, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options}) {

  const { id, elements, style } = com

  if (elements) {
    return (
      <div
        key={id}
        style={style}
      >
        {elements.map((com: any) => {
          return renderRstTraverseCom2({com, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options})
        })}
      </div>
    )
  } else {
    const jsx: any = getRenderComJSX({ com, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, index: index, _env, template, onError, logger, createPortal, options })

    return jsx?.jsx
  }

}

export default function RenderSlot({
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
                                     options
                                   }) {
  const {style, comAry, layoutTemplate, showType } = slot

  if (style.layout === "smart" && layoutTemplate) {
    const paramsStyle = params?.style;
    // const slotStyle = paramsStyle || style;
    const slotStyle = Object.assign(style, paramsStyle || {})
    return (
      <div data-isslot='1' className={`${calSlotClasses(slotStyle)}${root && className ? ` ${className}` : ''}`} style={{ overflow: root ? (showType === "module" ? "hidden" : "hidden auto") : "hidden", ...calSlotStyles(slotStyle, !!paramsStyle, root, slot.type === "module", env.edit), ...propsStyle}}>
        {layoutTemplate.map((rstTraverseElement: any, index: any) => {
          return renderRstTraverseCom2({com: rstTraverseElement, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal, options})
        })}
      </div>
    )
  }

  const itemAry = []
  comAry.forEach((com, idx) => {//组件逐个渲染
    const jsx = getRenderComJSX({ com, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, index: idx, _env, template, onError, logger, createPortal, options })
    if (jsx) {
      itemAry.push(jsx)
    }
  })

  if (typeof wrapper === 'function') {
    return wrapper(itemAry)
  } else {
    const paramsStyle = params?.style;
    // const slotStyle = paramsStyle || style;
    const slotStyle = Object.assign(style, paramsStyle || {})

    return (
      <div data-isslot='1' className={`${calSlotClasses(slotStyle)}${root && className ? ` ${className}` : ''}`} style={{overflow: root && showType === "module" ? "hidden" : null,...calSlotStyles(slotStyle, !!paramsStyle, root, slot.type === "module", env.edit), ...propsStyle}}>
        {itemAry.map(item => item.jsx)}
      </div>
    )
  }
}

function getRenderComJSX({ com, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, index, _env, template, onError, logger, createPortal, options }) {
  const {id, def, name, child, brother} = com
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
          jsx: (
            <div key={id}>
              <a
                href={permissionInfo?.hintLinkUrl || envPermissionInfo.hintLink}
                target="_blank"
                style={{textDecoration: 'underline'}}
                >{permissionInfo?.hintLinkTitle || envPermissionInfo.register.title}</a>
            </div>
          ),
          style: {}
        }
      }
      return
    }
  }
  const comDef = getComDef(def)

  if (comDef) {
    const props = context.get({comId: id, scope, _ioProxy: {
      inputs, outputs, _inputs, _outputs
    }})

    if (props) {
      const comKey = id + (scope ? scope.id : '') + index//考虑到scope变化的情况，驱动组件强制刷新
      return {
        id,
        jsx: <RenderCom key={comKey} com={com}
                        getComDef={getComDef}
                        context={context}
                        scope={scope}
                        props={props}
                        env={env}
                        _env={_env}
                        template={template}
                        onError={onError}
                        logger={logger}
                        createPortal={createPortal}
                        options={options}>
                          {brother?.map((brother, index) => {
                            return renderRstTraverseCom2({com: brother, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal})
                          })}
                          {child ? renderRstTraverseCom2({com: child, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal}) : null}
                          {/* {children?.length ? (
                            <div style={{position: 'absolute', top: 0, left: 0, width: "100%", height: "100%"}}>
                             {children.map((child, index) => {
                              console.log(child, "child")
                              return renderRstTraverseCom2({com: child, index, env, getComDef, context, scope, inputs, outputs, _inputs, _outputs, _env, template, onError, logger, createPortal})
                            })}
                            </div>
                          ) : null} */}
                          </RenderCom>,
        name,
        inputs: props.inputsCallable,
        style: props.style
      }
    } else {
      return {
        id, jsx: (
          <div className={css.error}>
            未找到组件({def.namespace}@{def.version} - {id})定义.
          </div>
        ), name, style: {}
      }
    }
  } else {
    return {
      id, jsx: (
        <div className={css.error}>
          未找到组件({def.namespace}@{def.version})定义.
        </div>
      ), name, style: {}
    }
  }
}

function RenderCom({
                     com,
                     props,
                     scope,
                     template,
                     env,
                     createPortal,
                     _env,
                     getComDef,
                     context,
                     onError,
                     logger,
                     children,
                     options
                   }) {
  const {id, def, name, slots = {}}: Com = com
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
  const [, setShow] = useState(false)

  useMemo(() => {
    const { pxToRem: configPxToRem, pxToVw: configPxToVw } = env

    const styleAry = getStyleAry({ env, def, style })

    if (Array.isArray(styleAry)) {
      const root = getStylesheetMountNode();
      if (!root.querySelector(`style[id="${id}"]`)) {
        const styleTag = document.createElement('style')
        let innerText = ''

        styleTag.id = id
        styleAry.forEach(({css, selector, global}) => {
          if (selector === ':root') {
            selector = '> *:first-child'
          }
          if (Array.isArray(selector)) {
            selector.forEach((selector) => {
              innerText = innerText + getStyleInnerText({id, css, selector, global, configPxToRem, configPxToVw})
            })
          } else {
            innerText = innerText + getStyleInnerText({id, css, selector, global, configPxToRem, configPxToVw})
          }
          
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
  }, [])

  const comDef = getComDef(def)

  const slotsProxy = new Proxy(slots, {
    get(target, slotId: string) {
      const slot = slots[slotId]
      if (!slot) {
        return
      }
      // const props = context.get({comId: id, slotId, scope: null})

      let currentScope;

      // const slot = slots[slotId]

      // if (slot?.type === 'scope') {
        if (scope) {
          currentScope = {
            id: scope.id + '-' + scope.frameId,
            frameId: slotId,
            parentComId: id,
            parent: scope
          }
        }
      // }

      const props = context.get({comId: id, slotId, scope: currentScope})

      // const errorStringPrefix = `组件(namespace=${def.namespace}）的插槽(id=${slotId})`

      // if (!props) {
      //   throw new Error(`${errorStringPrefix} 获取context失败.`)
      // }

      return {
        render(params: { key, inputValues, inputs, outputs, _inputs, _outputs, wrap, itemWrap, style, scope }) {
          const paramsScope = params?.scope
          if (paramsScope) {
            currentScope = {
              id: paramsScope.id + '-' + paramsScope.frameId,
              frameId: slotId,
              parentComId: id,
              parent: paramsScope
            }
          }
          if (slot) {
            return <SlotRender 
                               key={params?.key}
                               props={props}
                               currentScope={currentScope}
                               slotId={slotId}
                               slot={slot}
                               params={params}
                               style={style}
                               onError={onError}
                               createPortal={createPortal}
                               parentComId={id}
                               logger={logger} env={env} _env={_env} scope={scope} getComDef={getComDef} context={context} options={options}/>
          } else {
            return (
              <div className={css.error}>
                {`组件(namespace=${def.namespace}）的插槽(id=${slotId})`} 未找到.
              </div>
            )
          }
        },
        get size() {
          return !!slots[slotId]?.comAry?.length
        },
        _inputs: props._inputs,
        inputs: props.inputs,
        outputs: props.outputs
      }
    }
  })

  const parentSlot = useMemo(() => {
    if (props.frameId && props.parentComId) {
      // const slotProps = context.get({comId: props.parentComId, slotId: props.frameId, scope})
      // 取slot就行
      let finalScope = scope?.parentScope || scope
      const slotProps = context.get({comId: props.parentComId, slotId: props.frameId, scope: finalScope?.parent ? finalScope : null})
      // const slotProps = context.get({comId: props.parentComId, slotId: props.frameId, scope: scope?.parent})
      // const slotProps = context.get(props.parentComId, props.frameId, scope?.parent)
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
  }, [])

  const classes = getClasses({style, id})
  const sizeStyle = getSizeStyle({style})
  const marginStyle = getMarginStyle({style})

  const otherStyle: any = {}

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

  let jsx = comDef.runtime({
    id,
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
    slots: slotsProxy,
    createPortal,
    parentSlot,
    onError,
    logger,
  })

  useLayoutEffect(() => {
    setShow(true) // 在子组件写入前触发重新渲染，会执行上次等待的useEffect，内部inputs是同步执行，最终挂载dom
  }, [])

  // --- end

  if (typeof template === 'function') {
    jsx = template({id, jsx, name, scope})
  }

  // --- 2023.2.21 兼容小程序
  jsx = jsx ? (
    <div id={id} key={id} style={{
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
    }} className={classes}>
      <ErrorBoundary errorTip={`组件 (namespace = ${def.namespace}@${def.version}）渲染错误`} options={options}>
        {jsx}
        {/* TODO */}
        {/* <div style={{position: 'absolute', top: 0, left: 0}}>
          {children}
        </div> */}
        {children}
      </ErrorBoundary>
    </div>
  ) : null

  // --- end

  return jsx
}

function SlotRender ({
  slotId,
  parentComId,
  props,
  currentScope,
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
}) {
  const preInputValues = useRef(null)
  const { curScope, curProps } = useMemo(() => {
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
        for (let pro in ivs) {
          finalProps.inputs[pro](ivs[pro], finalScope)
        }
      }
    }
    finalProps.run(finalScope)

    return { curScope: finalScope, curProps: finalProps }
  }, [])

  useEffect(() => {
    const paramsInputValues = params?.inputValues
    if (paramsInputValues) {
      if (!preInputValues.current) {
        preInputValues.current = paramsInputValues
      } else if (typeof paramsInputValues === 'object' && (JSON.stringify(preInputValues.current) !== JSON.stringify(paramsInputValues))) {
        preInputValues.current = paramsInputValues
        for (let pro in paramsInputValues) {
          curProps.inputs[pro](paramsInputValues[pro], curScope)
        }
        curProps.run()
      }
    }
  }, [params?.inputValues])

  useEffect(() => {
    return () => {
      curProps.destroy()
    }
  }, [])

  const render = useMemo(() => {
    return (
      <RenderSlot
        scope={curScope}
        env={env}
        createPortal={createPortal}
        _env={_env}
        slot={slot}
        params={params}
        wrapper={params?.wrap}
        template={params?.itemWrap}
        getComDef={getComDef}
        context={context}
        inputs={params?.inputs}
        outputs={params?.outputs}
        _inputs={params?._inputs}
        _outputs={params?._outputs}
        onError={onError}
        logger={logger}
        options={options}
      />
    )
  }, [])

  return render
}

//-----------------------------------------------------------------------

function calSlotStyles(style, hasParamsStyle, root, isModule, isEdit) {
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
    if (style.heightAuto) {
      slotStyle.height = "fit-content"
    } else if (style.heightFull) {
      // if (isEdit) {
      //   slotStyle.height = style.height
      // } else {
      //   slotStyle.height = "100%"
      // }
      slotStyle.height = "100%"
    } else {
      slotStyle.height = style.height
    }

    if (style.widthAuto) {
      slotStyle.width = "fit-content"
    } else if (style.widthFull) {
      slotStyle.width = "100%"
      // if (isEdit) {
      //   slotStyle.width = style.width
      // } else {
      //   slotStyle.width = "100%"
      // }
    } else {
      slotStyle.width = style.width
    }
  }

  if (hasParamsStyle) {
    slotStyle = Object.assign(slotStyle, otherStyle)
  }

  return slotStyle
}

function calSlotClasses(slotStyle) {
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

function getClasses({style, id}) {
  const classes = [id, css.com]

  // 临时兼容
  if (style.flex === 1 && !style.widthFull) {
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

  if (maxWidth) {
    sizeStyle.maxWidth = maxWidth
  }

  if (minWidth) {
    sizeStyle.minWidth = minWidth
  }

  if (minHeight) {
    sizeStyle.minHeight = minHeight
  }

  if (isNumber(rotation)) {
    sizeStyle.transform = `rotate(${rotation}deg)`;
    sizeStyle.transformOrigin = 'center center';
  }

  return sizeStyle
}

function getMarginStyle({style}) {
  const marginStyle: any = {}
  const {
    width,
    margin,
    marginTop,
    marginLeft,
    marginRight,
    marginBottom
  } = style

  if (margin) {
    return {
      margin
    }
  }

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

  return marginStyle
}

function getStyleAry ({ env, style, def }) {
  const comThemes = env?.themes?.comThemes

  if (!comThemes) {
    return style.styleAry
  }

  let styleAry = style.styleAry

  const { themesId } = style
  const { namespace } = def

  if (!themesId && !styleAry) {
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
    // styleAry = style.styleAry
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
  // if (!styleAry) {
  //   return style.styleAry
  // }

  return styleAry
}

function getStyleInnerText ({id, css, selector, global, configPxToRem, configPxToVw}) {
  return `
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
}