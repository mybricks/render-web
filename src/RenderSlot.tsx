/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, {memo, useEffect, useMemo} from "react";

import {isNumber, uuid} from "./utils";

import css from "./RenderSlot.less";
import ErrorBoundary from "./ErrorBoundary";

export default function RenderSlot({
                                     scope,
                                     slot,
                                     params,
                                     inputs,
                                     outputs,
                                     _inputs,
                                     _outputs,
                                     wrapper,
                                     template,
                                     env,
                                     getComDef,
                                     getContext,
                                     __rxui_child__,
                                     onError,
                                     logger
                                   }) {
  const {style, comAry} = slot

  const itemAry = []
  comAry.forEach((com, idx) => {//组件逐个渲染
    const {id, def}: Com = com
    const comDef = getComDef(def)

    if (comDef) {
      const props = getContext(id, scope, {
        inputs, outputs, _inputs, _outputs
      })

      const comKey = (scope ? scope.id : '') + idx//考虑到scope变化的情况，驱动组件强制刷新
      itemAry.push({
        id,
        jsx: <RenderCom key={comKey} com={com}
                        getComDef={getComDef}
                        getContext={getContext}
                        scope={scope}
                        props={props}
                        env={env}
                        template={template}
                        onError={onError}
                        logger={logger}
                        __rxui_child__={__rxui_child__}/>,
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
        id, jsx
      })
    }

  })

  if (typeof wrapper === 'function') {
    return wrapper(itemAry)
  } else {
    const paramsStyle = params?.style;
    const slotStyle = paramsStyle || style;
    return (
      <div className={calSlotClasses(slotStyle)} style={calSlotStyles(slotStyle, !!paramsStyle)}>
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
                     getComDef,
                     getContext,
                     __rxui_child__,
                     onError,
                     logger
                   }) {
  const {id, def, slots = {}}: Com = com
  const {
    data,
    style,
    inputs: myInputs,
    outputs: myOutputs,
    _inputs: _myInputs,
    _outputs: _myOutputs
  } = props

  const comDef = getComDef(def)

  const slotsProxy = new Proxy(slots, {
    get(target, slotId: string) {
      const props = getContext(id, slotId)

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
                               logger={logger} env={env} scope={scope} getComDef={getComDef} getContext={getContext}
                               __rxui_child__={__rxui_child__}/>
          } else {
            return (
              <div className={css.error}>
                {errorStringPrefix} 未找到.
              </div>
            )
          }
        },
        _inputs: props._inputs,
        inputs: props.inputs,
        outputs: props.outputs
      }
    }
  })

  const parentSlot = useMemo(() => {
    if (props.frameId && props.parentComId) {
      const slotProps = getContext(props.parentComId, props.frameId, scope?.parent)
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

  const classes = getClasses({style})
  const sizeStyle = getSizeStyle({style})
  const marginStyle = getMarginStyle({style})

  const otherStyle: any = {}

  if (['fixed', 'absolute'].includes(style.position)) {
    if (style.position === "fixed" && style.fixedY === "bottom") {
      otherStyle.bottom = style.bottom;
    } else if (style.top) {
      otherStyle.top = style.top;
    }
    if (style.position === "fixed" && style.fixedX === "right") {
      otherStyle.right = style.right;
    } else if (style.left) {
      otherStyle.left = style.left;
    }
    otherStyle.zIndex = 1000;
  }


  let jsx = (
    <comDef.runtime
      id={id}
      env={env}
      data={data}
      style={style}
      inputs={myInputs}
      outputs={myOutputs}
      _inputs={_myInputs}
      _outputs={_myOutputs}
      slots={slotsProxy}
      createPortal={e => {

      }}
      parentSlot={parentSlot}
      __rxui_child__={__rxui_child__}
      onError={onError}
      logger={logger}
    />
  )

  if (typeof template === 'function') {
    jsx = template({id, jsx})
  }

  jsx = (
    <div key={id} style={{
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
  )

  return jsx
}

const SlotRender = memo(({
                           slotId,
                           props,
                           slot,
                           params,
                           scope,
                           env,
                           style,
                           getComDef,
                           getContext,
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
  if (params) {
    let nowScopeId = uuid()
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

  props.run(curScope)//传递scope

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

  return (
    // <div className={calSlotClasses(style)} style={calSlotStyles(style)}>
    <RenderSlot
      scope={curScope}
      env={env}
      slot={slot}
      params={params}
      wrapper={wrapFn}
      template={params?.itemWrap}
      getComDef={getComDef}
      getContext={getContext}
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
    return false
  }

  if (preKey !== nextKey) {//key 不同刷新
    return false
  }


  if (preKey !== void 0 && nextKey !== void 0 && preKey === nextKey) {
    if (prevProps.params?.inputValues !== nextProps?.params?.inputValues) {//对于存在key的情况，如果params不同，做刷新处理
      return false
    }
  }

  return true
})

//-----------------------------------------------------------------------

function calSlotStyles(style, hasParamsStyle) {
  // 兼容旧的style
  const {
    paddingLeft,
    paddingTop,
    paddingRight,
    paddingBottom,
    background,
    ...otherStyle
  } = style;
  let slotStyle = {
    paddingLeft: paddingLeft || 0,
    paddingTop: paddingTop || 0,
    paddingRight: paddingRight || 0,
    paddingBottom: paddingBottom || 0,
    //height: style.customHeight || '100%'
  } as any
  // 兼容旧的style
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

  if (hasParamsStyle) {
    slotStyle = Object.assign(slotStyle, otherStyle)
  }

  return slotStyle
}

function calSlotClasses(slotStyle) {
  const rtn = [css.slot]

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

function getClasses({style}) {
  const classes = [css.com]

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
