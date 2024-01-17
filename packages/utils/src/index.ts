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
          width: style.width,
          height: style.height,
          top: style.top,
          left: style.left,
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
        const com = coms[id]
        const modelStyle = com.model.style
        modelStyle.position = 'relative'
        result.push(comIdToSlotComMap[id])
      }
    })

    return result
  }
}

/**
 * 有一个前提，需要把元素按顺序排好
 */
function traverseElements(elements: any) {
  return calculateRow(elements)
}

function calculateRow(elements: any) {
  const rows: any = []
  let rowIndex = 0
  let height = 0
  let top = 0
  let finish = false

  /**
   * 分析行
   * - 高度 height
   * - 上外边距 top
   */
  elements.forEach((element) => {
    if (!rows[rowIndex]) {
      // 新的一行，直接赋值
      rows[rowIndex] = [element]
      height = element.height
      top = element.top
      finish = true
    } else {
      const elementHeight = element.height
      const elementTop = element.top

      if (elementTop >= height) {
        // top比height大，换行
        if (rows[rowIndex].length > 1) {
          rows[rowIndex] = calculateColumn(rows[rowIndex])
        }
        rowIndex = rowIndex + 1
        rows[rowIndex] = [element]
        height = elementHeight + elementTop
        top = elementTop
        finish = true
      } else {
        rows[rowIndex].push(element)
        finish = false
      }
    }
  })

  if (!finish) {
    rows[rowIndex] = calculateColumn(rows[rowIndex])
  }

  return rows.map((row: any) => {
    return {
      type: 'row',
      items: row
    }
  })
}

function calculateColumn(elements: any) {
  const columns: any = []
  let columnIndex = 0
  let width = 0
  let left = 0
  let finish = false

  /**
   * 分析列
   * - 宽度 width
   * - 左外边距 left
   */
  elements.forEach((element, index) => {
    if (!columns[columnIndex]) {
      // 新的一列，直接赋值
      columns[columnIndex] = [element]
      width = element.width
      left = element.left
      finish = true
    } else {
      const elementWidth = element.width
      const elementLeft = element.left

      if (elementLeft >= width) {
        // left比width大，换列
        if (columns[columnIndex].length > 1) {
          columns[columnIndex] = calculateRow(columns[columnIndex])
        }
        columnIndex = columnIndex + 1
        columns[columnIndex] = [element]
        width = elementWidth + elementLeft
        left = elementLeft
        finish = true
      } else {
        let count = index - 1

        while (count > -1) {
          const lastElement = elements[count]
          if (checkElementRelationship(lastElement, element)) {
            // TODO: 包含，还缺一个相交
            count = -2
            lastElement.children.push({
              ...element,
              top: element.top - lastElement.top,
              left: element.left - lastElement.left
            })
          } else {
            count = count - 1
          }
        }

        if (count != -2) {
          columns[columnIndex].push(element)
          finish = false
        }
      }
    }
  })

  if (!finish) {
    columns[columnIndex] = calculateRow(columns[columnIndex])
  }

  return columns.map((column: any) => {
    return {
      type: 'column',
      items: column
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