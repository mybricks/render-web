import css from './RenderSlot.less'
import React from "react";

export default function RenderSlot({slot, env, getComDef, getContext}) {
  return (
    slot.map(com => {//组件逐个渲染
      const {id, def, slots}: { def: { namespace } } = com
      const comDef = getComDef(def)

      if (comDef) {
        //在context中获取各类对象
        const {data, style, inputs, outputs} = getContext(id);

        //递归渲染插槽
        const slotsProxy = new Proxy({}, {
          get(target, slotId) {
            const props = getContext(id, slotId)
            if (!props) {
              throw new Error(`组件(namespace=${def.namespace}）的插槽(id=${slotId}) 获取context失败.`)
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
                      组件(namespace={def.namespace}）的插槽(id={slotId}) 未找到.
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
            overflow: 'hidden',
            // paddingTop: style.marginTop + 'px',
            // paddingBottom: style.marginBottom + 'px',
            // paddingLeft: style.marginLeft + 'px',
            // paddingRight: style.marginRight + 'px',
            position: style.position || 'relative',
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

  // if (node._focus) {
  //   classes.push(css.debugFocus)
  // }

  if (style.flex === 1) {
    classes.push(css.flex)
  }

  return classes.join(' ')
}

function getSizeStyle({style}) {
  const sizeStyle: any = {}
  const {width, height} = style

  if (!width) {
    sizeStyle.width = '100%'
  } else if (isNumber(width)) {
    sizeStyle.width = width + 'px'
  } else if (width) {
    sizeStyle.width = width
  }

  if (isNumber(height)) {
    sizeStyle.height = height + 'px'
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
    // if (marginTop > 0) {
    //   marginStyle.paddingTop = marginTop + 'px'
    // } else {
    //   marginStyle.marginTop = marginTop + 'px'
    // }
    marginStyle.marginTop = marginTop + 'px'
  }
  if (isNumber(marginLeft)) {
    // if (marginLeft > 0) {
    //   marginStyle.paddingLeft = marginLeft + 'px'
    // } else {
    //   marginStyle.marginLeft = marginLeft + 'px'
    // }
    if (typeof width === 'number' || marginLeft < 0) {
      marginStyle.marginLeft = marginLeft + 'px'
    } else {
      marginStyle.paddingLeft = marginLeft + 'px'
    }
  }
  if (isNumber(marginRight)) {
    // if (marginRight > 0) {
    //   marginStyle.paddingRight = marginRight + 'px'
    // } else {
    //   marginStyle.marginRight = marginRight + 'px'
    // }
    if (typeof width === 'number' || marginRight < 0) {
      marginStyle.marginRight = marginRight + 'px'
    } else {
      marginStyle.paddingRight = marginRight + 'px'
    }
  }
  if (isNumber(marginBottom)) {
    // if (marginBottom > 0) {
    //   marginStyle.paddingBottom = marginBottom + 'px'
    // } else {
    //   marginStyle.marginBottom = marginBottom + 'px'
    // }
    marginStyle.marginBottom = marginBottom + 'px'
  }


  return marginStyle

  return {
    marginTop: marginTop + 'px',
    marginLeft: marginLeft + 'px',
    marginRight: marginRight + 'px',
    marginBottom: marginBottom + 'px'
  }
}

function isNumber(num: any) {
  return typeof num === 'number' && !isNaN(num)
}
