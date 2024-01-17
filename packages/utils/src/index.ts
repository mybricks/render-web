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
  let rowIndex = 0
  // let width = 0
  // let left = 0
  // let height = 0
  // let top = 0
  let finish = false

  /**
   * 分析行
   * - 高度 height
   * - 上外边距 top
   */
  elements.sort((pre, cur) => pre.top - cur.top).forEach((element) => {
    if (!rows[rowIndex]) {
      // 新的一行，直接赋值
      rows[rowIndex] = [element]
      // width = element.width + element.left
      // left = element.left
      // height = element.height + element.top
      // top = element.top
      finish = true

      // 新行，TODO: 和上一个行对比，marginLeft应该在分列的时候使用
      // element.marginLeft = element.left
      element.marginTop = element.top

    } else {
      const elementHeight = element.height
      const elementTop = element.top

      // 上一行最后一个
      const lastElement = rows[rowIndex][rows[rowIndex].length - 1]
      if (elementTop >= lastElement.height + lastElement.top) {
        // top比height大，换行
        if (rows[rowIndex].length > 1) {
          rows[rowIndex] = calculateColumn(rows[rowIndex])
        }
        rowIndex = rowIndex + 1
        rows[rowIndex] = [element]
        // 如果是换行，那left就不用计算了，新行，TODO：非第一列情况
        // element.marginLeft = element.left
        element.marginTop = element.top - (lastElement.height + lastElement.top)
        
        // width = element.width + element.left
        // top = elementTop + height
        // height = elementHeight + elementTop
        // 换行后，left改为0
        finish = true
      } else {
        // 非第一行
        if (rowIndex) {
          // 行上一个
          const lastRowElement = rows[rowIndex - 1][rows[rowIndex - 1].length - 1]
          element.marginTop = element.top - (lastRowElement.height + lastRowElement.top)
        } else {
          element.marginTop = element.top
        }

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

  /**
   * 分析列
   * - 宽度 width
   * - 左外边距 left
   */
  elements.sort((pre, cur) => pre.left - cur.left).forEach((element, index) => {
    if (!columns.length) {
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
      items: column.length ? calculateRow(column) : column
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