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
        const style = coms[id].model.style

        comIdToSlotComMap[id] = com
  
        return {
          id,
          width: style.width || 0,
          height: style.height || 0,
          top: style.top || 0,
          left: style.left || 0,
          children: []
        }
      })), coms)
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

  traverseElementsToSlotComAry(comAry: any, coms: any) {
    const { comIdToSlotComMap } = this
    const result = []
    comAry.forEach((com) => {
      const { id, type, items } = com
      if (type) {
        result.push({
          type,
          items: this.traverseElementsToSlotComAry(items, coms)
        })
      } else {
        // 这里记得处理下包含关系，children?
        const modelStyle = coms[id].model.style
        modelStyle.position = 'relative'
        modelStyle.marginTop = com.marginTop
        modelStyle.marginLeft = com.marginLeft

        result.push(comIdToSlotComMap[id])
      }
    })

    return result
  }
}

/**
 * 有一个前提，需要把元素按顺序排好
 */
export function traverseElements(elements: any) {
  return calculateRow(elements)
}

function calculateRow(elements: any) {
  const rows: any = []

  /**
   * 分析行
   * - 高度 height
   * - 上外边距 top
   */
  elements.sort((pre, cur) => pre.top - cur.top).forEach((element) => {
    if (!rows.length) {
      element.marginTop = element.top
      rows.push([element])
    } else {
      let count = rows.length - 1
      while (count > -1) {
        const lastRows = rows[count]
        const rowsLength = lastRows.length

        for (let i = 0; i < rowsLength; i++) {
          const lastElement = lastRows[i]
          if (element.top >= lastElement.top + lastElement.height) {
            // TODO: 后面继续判断，两列也许可以拼成一列。总体marginTop
            element.marginTop = element.top - findMaxTopHeight(rows[count])

            rows.push([element])
            count = -2
            break
          } else {
            if (element.top >= lastElement.top) {
              rows[count].splice(i + 1, 0, element)
              count = -2
              break
            }
          }
        }
        count = count - 1
      }
    }
  })

  return rows.map((row: any) => {
    return {
      type: 'row',
      items: calculateColumn(row)
    }
  })
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

function calculateColumn(elements: any) {
  const columns: any = []

  /**
   * 分析列
   * - 宽度 width
   * - 左外边距 left
   */
  elements.sort((pre, cur) => pre.left - cur.left).forEach((element, index) => {
    if (!columns.length) {
      element.marginLeft = element.left
      columns.push([element])
    } else {
      let count = columns.length - 1
      while (count > -1) {
        const lastColumns = columns[count]
        const columnsLength = lastColumns.length

        for (let i = 0; i < columnsLength; i++) {
          const lastElement = lastColumns[i]
          if (element.left >= lastElement.left + lastElement.width) {
            // TODO: 后面继续判断，两列也许可以拼成一列。总体marginTop
            element.marginLeft = element.left - findMaxLeftWidth(columns[count])

            columns.push([element])
            count = -2
            break
          } else {
            if (element.left >= lastElement.left) {
              columns[count].splice(i + 1, 0, element)
              count = -2
              break
            }
          }
        }
        count = count - 1
      }
    }
  })

  return columns.map((column: any) => {
    return {
      type: 'column',
      items: column.length > 1 ? calculateRow(column) : column
    }
  })
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
    a_height + a_top >= b_height + b_top
  ) {
    return true
  }

  return false
}