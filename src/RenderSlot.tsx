import React from "react";

import { isNumber } from "./utils";

import css from "./RenderSlot.less";

export default function RenderSlot({slot, env, getComDef, getContext}) {
  return (
    slot.map(com => {//组件逐个渲染
      const { id, def, slots = {} }: Com = com
      const comDef = getComDef(def)

      if (comDef) {
        //在context中获取各类对象
        const {data, style, inputs, outputs} = getContext(id);

        //递归渲染插槽
        const slotsProxy = new Proxy(slots, {
          get(target, slotId: string) {
            const props = getContext(id, slotId)
            const errorStringPrefix = `组件(namespace=${def.namespace}）的插槽(id=${slotId})`

            if (!props) {
              throw new Error(`${errorStringPrefix} 获取context失败.`)
            }

            return {
              render() {
                const slot = slots[slotId]

                if (slot) {
                  return (
                    <RenderSlot
                      env={env}
                      slot={slot}
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

        return (
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
              slots={slotsProxy}
            />
          </div>
        );
      } else {
        return (
          <div className={css.error}>
            组件 (namespace = {def.namespace}）未找到.
          </div>
        )
      }
    })
  )
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
