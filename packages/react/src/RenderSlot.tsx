/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, {memo, useEffect, useMemo} from "react";

import {isNumber, uuid, pxToRem, pxToVw, convertCamelToHyphen} from "../../core/utils";

import lazyCss from "./RenderSlot.lazy.less";
import ErrorBoundary from "./ErrorBoundary";

const css = lazyCss.locals

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
                                     __rxui_child__,
                                     onError,
                                     logger
                                   }) {
  const {style, comAry} = slot

  const itemAry = []
  comAry.forEach((com, idx) => {//组件逐个渲染
    const {id, def, name}: Com = com
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
                        __rxui_child__={__rxui_child__}/>,
        name,
        inputs: props.inputsCallable,
        style: props.style
      })
    } else {
      const jsx = (
        <div className={css.error}>
          组件 (namespace = {def.namespace}）未找到.
        </div>
      )

      itemAry.push({
        id, jsx, name
      })
    }

  })

  if (typeof wrapper === 'function') {
    return wrapper(itemAry)
  } else {
    const paramsStyle = params?.style;
    const slotStyle = paramsStyle || style;
    return (
      <div data-isslot='1' className={`${calSlotClasses(slotStyle)}${root && className ? ` ${className}` : ''}`} style={{...calSlotStyles(slotStyle, !!paramsStyle, root), ...propsStyle}}>
        {itemAry.map(item => item.jsx)}
      </div>
    )
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
                     __rxui_child__,
                     onError,
                     logger
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

  useMemo(() => {
    const { pxToRem: configPxToRem, pxToVw: configPxToVw } = env

    const styleAry = getStyleAry({ env, def, style })

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
      const props = context.get(id, slotId, scope)

      const errorStringPrefix = `组件(namespace=${def.namespace}）的插槽(id=${slotId})`

      if (!props) {
        throw new Error(`${errorStringPrefix} 获取context失败.`)
      }

      return {
        render(params: { key, inputValues, inputs, outputs, _inputs, _outputs, wrap, itemWrap, style }) {
          const slot = slots[slotId]
          if (slot) {
            return <SlotRender slotId={slotId}
                               slot={slot}
                               props={props}
                               params={params}
                               style={style}
                               onError={onError}
                               createPortal={createPortal}
                               logger={logger} env={env} _env={_env} scope={scope} getComDef={getComDef} context={context}
                               __rxui_child__={__rxui_child__}/>
          } else {
            return (
              <div className={css.error}>
                {errorStringPrefix} 未找到.
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
      const slotProps = context.get(props.parentComId, props.frameId, scope?.parent)
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
    }
  }


  // --- 2023.2.21 兼容小程序
  
  // let jsx = (
  //   <comDef.runtime
  //     id={id}
  //     env={env}
  //     _env={_env}
  //     data={data}
  //     style={style}
  //     inputs={myInputs}
  //     outputs={myOutputs}
  //     _inputs={_myInputs}
  //     _outputs={_myOutputs}
  //     slots={slotsProxy}
  //     createPortal={e => {

  //     }}
  //     parentSlot={parentSlot}
  //     __rxui_child__={__rxui_child__}
  //     onError={onError}
  //     logger={logger}
  //   />
  // )

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
    __rxui_child__,
    onError,
    logger,
  })

  // --- end

  if (typeof template === 'function') {
    jsx = template({id, jsx, name})
  }

  // --- 2023.2.21 兼容小程序
  jsx = jsx ? (
    <div id={id} key={id} style={{
      display: style.display,
      // overflow: "hidden",
      position: style.position || "relative",
      ...otherStyle,
      ...sizeStyle,
      ...marginStyle,
      ...(style.ext || {})
    }} className={classes}>
      <ErrorBoundary errorTip={`组件 (namespace = ${def.namespace}@${def.version}）渲染错误`}>
        {jsx}
      </ErrorBoundary>
    </div>
  ) : null

  // --- end

  return jsx
}

const SlotRender = memo(({
                           slotId,
                           props,
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
                           __rxui_child__
                         }) => {
  // let curScope
  // //if (params) {
  // if (props.type==='scope') {//作用域插槽
  //
  //   let nowScopeId = uuid()
  //   //console.log(nowScopeId)
  //   // if (params.key) {
  //   //   nowScopeId = params.key + (scope ? ('-' + scope.id) : '')//考虑父级scope
  //   // }
  //   //
  //   // if (typeof params.wrap === 'function' && !params.key) {
  //   //   if (scope) {//存在父作用域，例如 List中嵌套FormContainer
  //   //     nowScopeId = scope.id
  //   //   }
  //   // }
  //
  //   curScope = {
  //     id: nowScopeId,
  //     frameId: slotId
  //   }
  //
  //   if (scope) {
  //     curScope.parent = scope
  //   }
  // } else {
  //   curScope = scope
  // }

  let curScope
  if (slot?.type === 'scope') {
    let nowScopeId = uuid(10, 16)
    //console.log(nowScopeId)
    // if (params.key) {
    //   nowScopeId = params.key + (scope ? ('-' + scope.id) : '')//考虑父级scope
    // }
    //
    // if (typeof params.wrap === 'function' && !params.key) {
    //   if (scope) {//存在父作用域，例如 List中嵌套FormContainer
    //     nowScopeId = scope.id
    //   }
    // }

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
  if (params) {
    const ivs = params.inputValues
    if (typeof ivs === 'object') {
      //requestAnimationFrame(() => {
      for (let pro in ivs) {
        props.inputs[pro](ivs[pro], curScope)
      }
      //})
    }

    if (typeof params.wrap === 'function') {
      wrapFn = params.wrap
    }
    //})
  }

  props.run(curScope)//传递scope

  useEffect(() => {
    return () => {
      props.destroy()
    }
  }, [])

  return (
    // <div className={calSlotClasses(style)} style={calSlotStyles(style)}>
    <RenderSlot
      scope={curScope}
      env={env}
      createPortal={createPortal}
      _env={_env}
      slot={slot}
      params={params}
      wrapper={wrapFn}
      template={params?.itemWrap}
      getComDef={getComDef}
      context={context}
      inputs={params?.inputs}
      outputs={params?.outputs}
      _inputs={params?._inputs}
      _outputs={params?._outputs}
      onError={onError}
      logger={logger}
      __rxui_child__={__rxui_child__}
    />
    // </div>
  )

}, (prevProps, nextProps) => {
  const preKey = prevProps.params?.key, nextKey = nextProps?.params?.key
  if (preKey === void 0 && nextKey === void 0) {//对于没有key的情况，统一做刷新处理
    return true
  }

  if (preKey !== nextKey) {//key 不同刷新
    return false
  }

  // TODO
  if (preKey !== void 0 && nextKey !== void 0 && preKey === nextKey) {
    try {
      if (JSON.stringify(prevProps.params?.inputValues) !== JSON.stringify(nextProps.params?.inputValues)) {
        return false
      }
    } catch {}
  }

  return true
})

//-----------------------------------------------------------------------

function calSlotStyles(style, hasParamsStyle, root) {
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
    backgroundColor: backgroundColor || (root ? '#ffffff' : void 0),
    backgroundImage,
    backgroundPosition,
    backgroundRepeat,
    backgroundSize,
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

  if (style.flex === 1) {
    classes.push(css.flex)
  }

  return classes.join(" ")
}

function getSizeStyle({style}) {
  const sizeStyle: any = {}
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

  return sizeStyle
}

function getMarginStyle({style}) {
  const marginStyle: any = {}
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

  return marginStyle
}

function getStyleAry ({ env, style, def }) {
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