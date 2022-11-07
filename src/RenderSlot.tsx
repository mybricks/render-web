/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

import React, {memo} from "react";

import {isNumber} from "./utils";

import css from "./RenderSlot.less";

export default function RenderSlot({scopeId, slot, wrapper, env, getComDef, getContext}) {
  const {style, comAry} = slot

  const itemAry = []
  comAry.forEach((com, idx) => {//组件逐个渲染
    const {id, def, slots = {}}: Com = com
    const comDef = getComDef(def)
    const scope = scopeId ? {id: scopeId} : void 0

    let jsx
    if (comDef) {
      //在context中获取各类对象
      const {data, style, inputs, inputsCallable, outputs, _inputs, _outputs} = getContext(id, scope);

      //递归渲染插槽
      const slotsProxy = new Proxy(slots, {
        get(target, slotId: string) {
          const props = getContext(id, slotId)
          const errorStringPrefix = `组件(namespace=${def.namespace}）的插槽(id=${slotId})`

          if (!props) {
            throw new Error(`${errorStringPrefix} 获取context失败.`)
          }

          return {
            render(params) {
              //const TX = memo(({params}) => {
              const slot = slots[slotId]

              if (slot) {
                props.run()

                let nowScopeId, wrapFn
                if (params) {
                  if (params.key) {
                    nowScopeId = `${scopeId ? (scopeId + '/') : ''}${params.key}`
                  } else {
                    nowScopeId = scopeId
                  }

                  const scope = nowScopeId ? {id: nowScopeId} : void 0
                  //setTimeout(v => {
                  const ivs = params.inputValues
                  if (typeof ivs === 'object') {
                    for (let pro in ivs) {
                      props.inputs[pro](ivs[pro], scope)
                    }
                  }

                  if (typeof params.wrap === 'function') {
                    wrapFn = params.wrap
                  }
                  //})
                }

                return (
                  <RenderSlot
                    scopeId={nowScopeId}
                    env={env}
                    slot={slot}
                    wrapper={wrapFn}
                    getComDef={getComDef}
                    getContext={getContext}
                  />
                )
              } else {
                return (
                  <div className={css.error}>
                    {errorStringPrefix} 未找到.
                  </div>
                )
              }
              // })
              //
              // return <TX params={params}/>
            },
            inputs: props.inputs,
            outputs: props.outputs
          }
        }
      })

      const classes = getClasses({style})
      const sizeStyle = getSizeStyle({style})
      const marginStyle = getMarginStyle({style})

      const otherStyle: any = {}

      // switch (true) {
      //   case ['fixed'].includes(style.position): {
      //     otherStyle.position = 'fixed'
      //     otherStyle.zIndex = 1000;
      //     style.fixedX === 'right' ? (otherStyle.right = style.right + 'px') : (otherStyle.left = style.left + 'px');
      //     style.fixedY === 'bottom' ? (otherStyle.bottom = style.bottom + 'px') : (otherStyle.top = style.top + 'px');
      //     break
      //   }
      //
      //   case ['absolute'].includes(style.position) || (parent.style.layout === 'absolute' && style.position === undefined): {
      //     otherStyle.position = 'absolute'
      //     otherStyle.zIndex = 1000;
      //     otherStyle.top = style.top + 'px';
      //     otherStyle.left = style.left + 'px';
      //     break
      //   }
      //   default: {
      //     break
      //   }
      // }

      jsx = (
        <div key={id} style={{
          display: style.display,
          overflow: "hidden",
          position: style.position || "relative",
          ...otherStyle,
          ...sizeStyle,
          ...marginStyle,
          ...(style.ext || {})
        }} className={classes}>
          <comDef.runtime
            env={env}
            data={data}
            style={style}
            inputs={inputs}
            outputs={outputs}
            _inputs={_inputs}
            _outputs={_outputs}
            slots={slotsProxy}
          />
        </div>
      )

      itemAry.push({
        id, jsx, inputs: inputsCallable
      })
    } else {
      jsx = (
        <div className={css.error}>
          组件 (namespace = {def.namespace}）未找到.
        </div>
      )

      itemAry.push({
        id, jsx
      })
    }
  })

  if (wrapper) {
    return wrapper(itemAry)
  } else {
    return (
      <div className={calSlotClasses(style)} style={calSlotStyles(style)}>
        {itemAry.map(item => item.jsx)}
      </div>
    )
  }
}

//-----------------------------------------------------------------------

function calSlotStyles(style) {
  const slotStyle = {
    paddingLeft: style.paddingLeft || 0,
    paddingTop: style.paddingTop || 0,
    paddingRight: style.paddingRight || 0,
    paddingBottom: style.paddingBottom || 0,
    //height: style.customHeight || '100%'
  } as any

  if (style.background) {
    const {
      background: bg,
      backgroundImage,
      backgroundColor,
      backgroundRepeat,
      backgroundSize
    } = style.background;

    slotStyle.backgroundRepeat = backgroundRepeat
    slotStyle.backgroundSize = backgroundSize

    if (bg) {
      slotStyle.background = bg
    } else {
      slotStyle.backgroundImage = backgroundImage
      slotStyle.backgroundColor = backgroundColor
    }
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
