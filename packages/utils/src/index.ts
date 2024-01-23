interface ToJSON {
  [key: string]: any
}

export function transformToJSON(toJSON: ToJSON) {
  const { global, modules, scenes } = toJSON
  if (!scenes) {
    return toJSON
  }
  if (global) {
    const { comsReg, consReg, pinRels, fxFrames, pinProxies } = global
    if (comsReg) {
      Object.keys(comsReg).forEach((key) => {
        comsReg[key].global = true
      })
    }
    if (Array.isArray(fxFrames)) {
      fxFrames.forEach((fxFrame) => {
        if (comsReg) {
          Object.assign(fxFrame.coms, comsReg)
        }
        if (consReg) {
          Object.assign(fxFrame.cons, consReg)
        }
        if (pinRels) {
          Object.assign(fxFrame.pinRels, pinRels)
        }
        if (pinProxies) {
          Object.assign(fxFrame.pinProxies, pinProxies)
        }
      })
    }
    if (modules) {
      Object.entries(modules).forEach(([key, module]: any) => {
        const { json } = module
        if (comsReg) {
          Object.assign(json.coms, comsReg)
        }
        if (consReg) {
          Object.assign(json.cons, consReg)
        }
        if (pinRels) {
          Object.assign(json.pinRels, pinRels)
        }
        if (pinProxies) {
          Object.assign(json.pinProxies, pinProxies)
        }
      })
    }
    // TODO: 临时写死的，等引擎提供数据
    const transform = new Transform()
    scenes.forEach((scene: any) => {
      transform.transformSlotComAry(scene.slot, scene.coms)

      if (comsReg) {
        Object.assign(scene.coms, comsReg)
      }
      if (consReg) {
        Object.assign(scene.cons, consReg)
      }
      if (pinRels) {
        Object.assign(scene.pinRels, pinRels)
      }
      if (pinProxies) {
        Object.assign(scene.pinProxies, pinProxies)
      }
    })
  }

  return toJSON
}

class Transform {

  comIdToSlotComMap = {}

  transformSlotComAry(slot, coms) {
    const { comIdToSlotComMap } = this
    const { comAry } = slot
  
    // TODO: 目前引擎可以通过这个字段来判断是否智能布局
    if (slot.style.layout === "absolute-smart") {
      const resultComAry = comAry.sort((preCom, curCom) => {
        const { id: preId, slots: preSlots } = preCom
        const { id: curId, slots: curSlots } = curCom
  
        if (preSlots) {
          Object.entries(preSlots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
        if (curSlots) {
          Object.entries(curSlots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
  
        const preStyle = coms[preId].model.style
        const preTop = preStyle.top
        const preLeft = preStyle.left
        const curStyle = coms[curId].model.style
        const curTop = curStyle.top
        const curLeft = curStyle.left
    
        if (preTop === curTop) {
          return preLeft - curLeft
        }
    
        return preTop - curTop
      })

      slot.comAry2 = this.traverseElementsToSlotComAry(traverseElements(resultComAry.map((com) => {
        const id = com.id
        const comInfo = coms[id]
        const style = comInfo.model.style
        const calculateStyle = comInfo.style

        comIdToSlotComMap[id] = com
  
        return {
          id,
          width: calculateStyle.width || 0,
          height: calculateStyle.height || 0,
          top: style.top || 0,
          left: style.left || 0,
          children: [],
          brother: []
        }
      }), { width: slot.style.width }), coms, "items")
      console.log("comAry 结果: ", slot.comAry2)
    } else {
      comAry.forEach((com) => {
        const { slots } = com
        if (slots) {
          Object.entries(slots).forEach(([slotId, slot]) => {
            this.transformSlotComAry(slot, coms)
          })
        }
      })
    }
  }

  traverseElementsToSlotComAry(comAry: any, coms: any, nextType: any) {
    const { comIdToSlotComMap } = this
    const result = []
    comAry.forEach((com) => {
      const { id, type, items, children, brother, style } = com
      if (type) {
        Reflect.deleteProperty(style, 'width')
        result.push({
          type,
          style,
          items: this.traverseElementsToSlotComAry(items, coms, type)
        })
      } else {
        // TODO: 临时 children是包含关系，brother是相交关系
        if (nextType === "brother") {
          const modelStyle = coms[id].model.style
          modelStyle.position = 'absolute'
          modelStyle.top = com.top
          modelStyle.left = com.left
        } else {
          // 这里记得处理下包含关系，children?
          const modelStyle = coms[id].model.style
          modelStyle.position = 'relative'
          // 观察: 删除了组件的margin，用行列来替代
          // modelStyle.marginTop = com.marginTop
          // modelStyle.marginLeft = com.marginLeft
        }

        result.push({
          ...comIdToSlotComMap[id],
          children: this.traverseElementsToSlotComAry(children, coms, "children"),
          brother: this.traverseElementsToSlotComAry(brother, coms, "brother"),
        })
      }
    })

    return result
  }
}

/**
 * 有一个前提，需要把元素按顺序排好
 */
export function traverseElements(elements: any, config: any) {
  return calculateRow(elements, config)
}

function calculateRow(elements: any, config: any) {
  const rows: any = []
  // 记录最高的高度，后续如果有大于最高高度的，那就换行
  let maxHeight = 0
  /**
   * 分析行
   * - 高度 height
   * - 上外边距 top
   */
  elements.sort((pre, cur) => pre.top - cur.top).forEach((element) => {
    if (!rows.length) {
      // 新行设置marginTop，观察
      if (typeof element.marginTop === 'undefined') {
        element.marginTop = element.top
      }
      rows.push([element])
      maxHeight = element.top + element.height
    } else {
      if (element.top >= maxHeight) {
        // 换行
        element.marginTop = element.top - maxHeight
        rows.push([element])
        maxHeight = element.top + element.height
      } else {
        const curRow = rows[rows.length -1]
        const lastElement = curRow[curRow.length -1]
        element.marginTop = element.top - (lastElement.top - lastElement.marginTop)
        const curMaxHeight = element.top + element.height
        if (curMaxHeight > maxHeight) {
          maxHeight = curMaxHeight
        }
        rows[rows.length -1].push(element)
      }
    }
  })

  return rows.map((row: any) => {
    const items = calculateColumn(row, config)
    return {
      type: 'row',
      style: {},
      // 后面再考虑弹性的问题
      // style: calculateRowStyle(items, config),
      items
    }
  })
}

function calculateRowStyle(elements: any, config: any) {
  // 先计算横向的
  const { width: containerWidth } = config
  const rowStyle: any = {}
  let start = 0
  let end = 0
  let spacings = []
  let curWidth = 0
  let elementWidth = 0
  const elementsLength = elements.length - 1
  elements.forEach((element, index) => {
    const { width: elemenStyletWidth = 0, marginLeft: elementStyleMarginLeft = 0 } = element.style
    elementWidth = elementWidth + elemenStyletWidth
    curWidth = curWidth + elementStyleMarginLeft + elemenStyletWidth
    if (index === 0) {
      start = elementStyleMarginLeft
    } else {
      spacings.push(elementStyleMarginLeft)
    }
    if (elementsLength === index) {
      end = containerWidth - curWidth
    }
  })

  const spacing = spacings[0]
  const sameStartEnd = start === end
  const sameSpacing = spacings.reduce((pre, cur) => pre + cur, 0) === spacing * spacings.length

  if (sameStartEnd && sameSpacing) {
    // 最基本的，前后、间距也必须相等
    if (spacing === start) {
      // 全部间距完全相等
      rowStyle.justifyContent = 'space-evenly'
    } else if (spacing / 2 === start) {
      // 前后间距是元素间间距的二分之一
      rowStyle.justifyContent = 'space-around'
    } else if (start === 0) {
      // 前后是0
      rowStyle.justifyContent = 'space-between'
    }
  }

  if (!rowStyle.justifyContent) {
    // 有可能整体是居中的？
    if (sameStartEnd) {
      rowStyle.justifyContent = 'center'
      // elements[0].style.width = "100%"
      // elements[0].style.margin = `0 ${start}px`
      // TODO: 持续观察
      Reflect.deleteProperty(elements[0].style, 'marginLeft')
    }
  } else {
    elements.forEach((element) => {
      // TODO: 持续观察
      Reflect.deleteProperty(element.style, 'marginLeft')
    })
  }

  return rowStyle
}

function findMaxTopHeight(elements: any) {
  let maxSum = 0
  for (var i = 0; i < elements.length; i++) {
    let sum = elements[i].height + elements[i].top
    if (sum > maxSum) {
      maxSum = sum
    }
  }
  return maxSum
}

function findMaxLeftWidth(elements: any) {
  let maxSum = 0
  for (var i = 0; i < elements.length; i++) {
    let sum = elements[i].width + elements[i].left
    if (sum > maxSum) {
      maxSum = sum
    }
  }
  return maxSum
}

function calculateColumn(elements: any, config: any) {
  const columns: any = []
  // 记录最宽的宽度，后续如果有大于最宽宽度的，那就换列
  let maxWidth = 0

  /**
   * 分析列
   * - 宽度 width
   * - 左外边距 left
   */
  elements.sort((pre, cur) => pre.left - cur.left).forEach((element, index) => {
    if (!columns.length) {
      // 新行设置marginLeft，观察
      if (typeof element.marginLeft === 'undefined') {
        element.marginLeft = element.left
      }
      columns.push([element])
      maxWidth = element.left + element.width
    } else {
      if (element.left >= maxWidth) {
        // 换行
        element.marginLeft = element.left - maxWidth
        columns.push([element])
        maxWidth = element.left + element.width
      } else {
        const curColumn = columns[columns.length -1]
        let count = curColumn.length - 1

        // 这里之后看下怎么优化
        while (count > -1) {
          const lastElement = curColumn[count]
          const relationship = checkElementRelationship(lastElement, element)
          if (relationship === 'include') {
            // 包含
            lastElement.children.push(element)
            count = -1
          } else if (relationship === 'intersect') {
            // 相交，相对lastElement绝对定位
            element.top = element.top - lastElement.top
            element.left = element.left - lastElement.left
            lastElement.brother.push(element)
            count = -1
          }
          count = count - 1
        }

        if (count != -2) {
          // 说明是非包含非相交情况
          const lastElement = curColumn[curColumn.length -1]
          element.marginLeft = element.left - (lastElement.left - lastElement.marginLeft)
          const curMaxWidth = element.left + element.width
          if (curMaxWidth > maxWidth) {
            maxWidth = curMaxWidth
          }
          curColumn.push(element)
        }
      }
    }
  })

  columns.forEach((column) => {
    column.forEach(({ children, marginTop, marginLeft, width }, index) => {
      if (children.length) {
        children.forEach((child) => {
          child.top = child.top - marginTop
          child.left = child.left - marginLeft
          // TODO: 临时的为了方便render-web使用
          Reflect.deleteProperty(child, "marginTop")
        })
        column[index].children = traverseElements(children, config)
      }
    })
  })

  return columns.map((column: any) => {
    const items = column.length > 1 ? calculateRow(column, config) : column
    let marginLeft = 0
    let marginTop = 0
    let width = 0
    // 这里计算列的marginTop、marginLeft，元素不再有这两个属性

    items.forEach((item) => {
      const { items } = item
      
      if (Array.isArray(items)) {
        let curWidth = 0
        items.forEach((item) => {
          const { width: itemWidth, marginTop: itemMarginTop, marginLeft: itemMarginLeft } = item.style
          curWidth = curWidth + itemWidth + itemMarginLeft
        })
        if (width < curWidth) {
          width = curWidth
        }
      } else {
        marginLeft = item.marginLeft
        marginTop = item.marginTop
        width = item.width
      }
    })

    return {
      type: 'column',
      style: {
        marginLeft,
        marginTop,
        width
      },
      items
    }
  })
}

function calculateColumnStyle(elements: any) {
  // console.log("计算列style: ", elements)
  return {}
}

/**
 * - elementA 被对比
 * - elementB 对比
 */
function checkElementRelationship(elementA: any, elementB: any) {
  const { width: a_width, height: a_height, top: a_top, left: a_left } = elementA
  const { width: b_width, height: b_height, top: b_top, left: b_left } = elementB

  // 仅包含了
  if (
    a_width + a_left >= b_width + b_left && // 右侧包含
    a_top <= b_top && // 上侧包含
    a_left <= b_left && // 左侧包含
    a_height + a_top >= b_height + b_top // 下侧包含
  ) {
    return 'include'
  }

  if (
    (b_left >= a_left && (b_left < a_left + a_width) && (b_top >= a_top) && b_top <= (a_top + a_height)) && !(b_top === a_top || b_top === (a_top + a_height)) || // 左上角
    (b_left > a_left && (b_left < a_left + a_width) && (a_top <= b_top + b_height) && (b_top + b_height <= a_top + a_height)) || // 左下角
    ((b_left + b_width > a_left) && (b_left + b_width < a_left + a_width) && (b_top > a_top) && b_top < (a_top + a_height)) || // 右上角
    ((b_left + b_width > a_left) && (b_left + b_width < a_left + a_width) && (b_top + b_height > a_top) && (b_top + b_height < a_top + a_height)) // 右下角
  ) {
    return 'intersect'
  }

  return
}