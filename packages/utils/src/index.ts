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

      // slot.comAry2 = this.traverseElementsToSlotComAry(traverseElements(resultComAry.map((com) => {
      //   const id = com.id
      //   const comInfo = coms[id]
      //   const style = comInfo.model.style
      //   const calculateStyle = comInfo.style

      //   comIdToSlotComMap[id] = com
  
      //   return {
      //     id,
      //     width: calculateStyle.width || 0,
      //     height: calculateStyle.height || 0,
      //     top: style.top || 0,
      //     left: style.left || 0,
      //     children: [],
      //     brother: []
      //   }
      // }), { width: slot.style.width }), coms, "items")

      slot.comAry2 = this.traverseElementsToSlotComAry2(traverseElements2(resultComAry.map((com) => {
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
      }), { width: slot.style.width }), coms)

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

  traverseElementsToSlotComAry2(comAry: any, coms: any) {
    const { comIdToSlotComMap } = this
    const result = []
    comAry.forEach((com) => {
      const { id, elements, marginLeft, marginTop, flexDirection, height, width } = com

      if (Array.isArray(elements)) {
        result.push({
          ...com,
          elements: this.traverseElementsToSlotComAry2(elements, coms)
        })
      } else {
        const modelStyle = coms[id].model.style
        modelStyle.position = 'relative'
        modelStyle.marginTop = marginTop
        modelStyle.marginLeft = marginLeft
        result.push(comIdToSlotComMap[id])
      }

      

      // const { id, type, items, children, brother, style } = com
      // if (type) {
      //   Reflect.deleteProperty(style, 'width')
      //   result.push({
      //     type,
      //     style,
      //     items: this.traverseElementsToSlotComAry2(items, coms, type)
      //   })
      // } else {
      //   // TODO: 临时 children是包含关系，brother是相交关系
      //   if (nextType === "brother") {
      //     const modelStyle = coms[id].model.style
      //     modelStyle.position = 'absolute'
      //     modelStyle.top = com.top
      //     modelStyle.left = com.left
      //   } else {
      //     // 这里记得处理下包含关系，children?
      //     const modelStyle = coms[id].model.style
      //     modelStyle.position = 'relative'
      //     // 观察: 删除了组件的margin，用行列来替代
      //     // modelStyle.marginTop = com.marginTop
      //     // modelStyle.marginLeft = com.marginLeft
      //   }

      //   result.push({
      //     ...comIdToSlotComMap[id],
      //     children: this.traverseElementsToSlotComAry2(children, coms, "children"),
      //     brother: this.traverseElementsToSlotComAry2(brother, coms, "brother"),
      //   })
      // }
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

export function traverseElements2(elements, config) {
  const traverseElements = new TraverseElements(elements, config)
  const res = traverseElements.getElements()
  console.log("traverseElements2结果: ", res)
  return res
}

class TraverseElements {
  constructor(private elements, private config) {}

  getElements() {
    const { elements } = this
    const eleGroup = this.splitElements(this.handleIntersectionsAndInclusions(elements))
    // console.log("最终结果eleGroup: ", eleGroup)
  
    
    return this.handleEleGroup(eleGroup, { top: 0, left: 0 })
  }

  handleEleGroup(elements, { top: pTop, left: pLeft }) {
    const resEles: any = []
    let curTop = pTop
    let curLeft = pLeft
    // console.log(elements.length, "elements.length")
    // console.log("elements", elements.map(ele => ele.id))

    if (elements.length === 1) {
      const ele = elements[0]
      // console.log(ele.id, '只有一项', { top: pTop, left: pLeft })
      const resEle: any = {
        ...ele,
        marginTop: ele.top - curTop,
        marginLeft: ele.left - curLeft
      }
      // console.log(111, "marginLeft: ", ele.id, ele.left - curLeft)
      if (Array.isArray(ele.elements)) {
        resEle.elements = this.handleEleGroup(ele.elements, {
          top: resEle.marginTop,
          left: resEle.marginLeft
        })
      }
      resEles.push(resEle)
    } else {
      let curTop = pTop
      let curLeft = pLeft
      elements.forEach((ele) => {
        const resEle: any = {...ele}
        const parentFlexDirection = ele.parentFlexDirection
        // console.log("parentFlexDirection", parentFlexDirection, ele.id)
        resEle.marginLeft = ele.left - curLeft
        // console.log(222, "marginLeft: ", ele.id, ele.left - curLeft, ele.left, curLeft, JSON.parse(JSON.stringify(ele)))
        resEle.marginTop = ele.top - curTop

        if (Array.isArray(ele.elements)) {
          // console.log(333, ele.id, ele.left - curLeft, curLeft)
          resEle.elements = this.handleEleGroup(ele.elements, { 
            // top: curTop, 
            // top: ele.top - curTop,
            // left: ele.left - curLeft
            top: curTop + resEle.marginTop,
            left: curLeft + resEle.marginLeft
          })
        }

        if (parentFlexDirection === 'row') {
          curLeft = ele.left + ele.width
        } else if (parentFlexDirection === 'column') {
          curTop = ele.top + ele.height
        }

        resEles.push(resEle)
      })
    }


    // elements.forEach((item) => {
    //   const parentFlexDirection = item.parentFlexDirection

    //   // if (parentFlexDirection === 'column')

    //   console.log("111, ", item.id, parentFlexDirection)
    //   const resEle: any = {...item}
    //   // curTop = item.top - curTop
    //   // curLeft = item.left - curLeft
    //   // const marginTop = item.top - top
    //   // const marginLeft = item.left - left


    //   // console.log("遍历处理margin：", item.id, {
    //   //   width: item.width,
    //   //   height: item.height, 
    //   //   top: item.top,
    //   //   left: item.left,
    //   //   marginTop: item.top - curTop,
    //   //   marginLeft: item.left - curLeft,
    //   //   // curTop,
    //   //   // curLeft
    //   // })

    //   // console.log({curTop, curLeft})
    //   resEle.marginTop = item.top - curTop
    //   resEle.marginLeft = item.left - curLeft

    //   const { elements } = item
    //   if (Array.isArray(elements)) {
    //     resEle.elements = this.handleEleGroup(elements, { 
    //       // top: curTop, 
    //       top: item.top,
    //       left: item.left - curLeft 
    //     })
    //   }
    //   resEles.push(resEle)

    //   curTop = item.height + item.top
    //   // curLeft = curLeft + item.left

    // })


    // 处理下间距等
    // let top,left,width,height
    // let flexDirection
    // elements.forEach((ele) => {
    //   console.log(ele, 'element')
    //   // if (typeof top !== 'number' || top > ele.top) {
    //   //   top = ele.top
    //   // }
    //   // if (typeof left !== 'number' || left > ele.left) {
    //   //   left = ele.left
    //   // }
    //   // if (typeof width !== 'number' || width < ele.width + ele.left) {
    //   //   width = ele.width + ele.left
    //   // }
    //   // if (typeof height !== 'number' || height < ele.height + ele.top) {
    //   //   height = ele.height + ele.top
    //   // }
    //   // // console.log({left, width, eleft: ele.left, ewidth: ele.width}, ele.id)

    //   // if (left < ele.left) {
    //   //   flexDirection = 'row'
    //   // }
    // })
    // console.log("flexDirection: ", flexDirection)
    // console.log("elements", elements.map(ele => ele.id))

    return resEles
  }

  handleIntersectionsAndInclusions(elements: any) {
    // 处理包含和相交关系
    return elements
  }

  // 拆分
  splitElements(elements: any) {
    const eleIdToInfo = {}
    const eleGroup = []

    elements.sort((pre, cur) => {
      if (pre.top === cur.top) {
        return pre.left - cur.left
      }
      return pre.top - cur.top
    }).forEach((element, index) => {
      let x
      let y
      for (let i = 0; i < elements.length; i++) {
        const cEle = elements[i]
        if (cEle.id !== element.id) {
          if (cEle.left >= element.left + element.width && cEle.top < element.top + element.height && (!x ? true : x.left > cEle.left) && element.top < cEle.top + cEle.height) {
            // 这里要选出最小的
            x = cEle
          }
          if (cEle.top >= element.top + element.height && cEle.left < element.left + element.width && (!y ? true : y.top > cEle.top) && element.left < cEle.left + cEle.width) {
            // 这里要选出最小的
            y = cEle
          }
        }
        // TODO: 看看能不能提前结束
      }

      /**
       * 距离最近的元素(被对比元素)
       */
      let resEle
      /**
       * x距离
       */
      let xSpace
      /**
       * y距离
       */
      let ySpace

      /**
       * 横向对比
       */
      let isX
      /**
       * 纵向对比
       */
      let isY

      if (x && y) {
        /**
         * 两个都有，选最近的，如果相等选x
         */
        if (x.left - (element.left + element.width) <= y.top - (element.top + element.height)) {
          resEle = x
        } else {
          resEle = y
        }
        xSpace = x.left - (element.left + element.width)
        ySpace = y.top - (element.top + element.height)
        if (xSpace <= ySpace) {
          isX = true
        } else {
          isY = true
        }
      } else if (x) {
        xSpace = x.left - (element.left + element.width)
        resEle = x
        isX = true
      } else if (y) {
        ySpace = y.top - (element.top + element.height)
        resEle = y
        isY = true
      }

      if (!eleIdToInfo[element.id]) {
        eleIdToInfo[element.id] = {
          topEles: [],
          leftEles: [],
          rightEles: [],
          bottomEles: []
        }
      }
      if (typeof xSpace === 'number') {
        eleIdToInfo[element.id].right = xSpace
        eleIdToInfo[element.id].rightEles.push(resEle)
      }
      if (typeof ySpace === 'number') {
        eleIdToInfo[element.id].bottom = ySpace
        eleIdToInfo[element.id].bottomEles.push(resEle)
      }
      if (x) {
        if (!eleIdToInfo[x.id]) {
          eleIdToInfo[x.id] = {
            topEles: [],
            leftEles: [],
            rightEles: [],
            bottomEles: []
          }
        }
        eleIdToInfo[x.id].leftEles.push(element)
      }
      if (y) {
        if (!eleIdToInfo[y.id]) {
          eleIdToInfo[y.id] = {
            topEles: [],
            leftEles: [],
            rightEles: [],
            bottomEles: []
          }
        }
        eleIdToInfo[y.id].topEles.push(element)
      }

      if (resEle) {
        if (typeof xSpace === 'number' && typeof ySpace === 'number') {
          if (xSpace > ySpace) {
            eleIdToInfo[resEle.id].top = ySpace
          } else {
            eleIdToInfo[resEle.id].left = xSpace
          }
        } else if (typeof xSpace === 'number') {
          eleIdToInfo[resEle.id].left = xSpace
        } else if (typeof ySpace === 'number') {
          eleIdToInfo[resEle.id].top = ySpace
        }
      }

      /**
       * 当前元素的信息
       */
      const eleInfo = eleIdToInfo[element.id]
      /**
       * 被对比元素的信息
       */
      const resEleInfo = eleIdToInfo[resEle?.id]
      
      const haslog = element.id === "u_u8wIa"
      if (isX) {
        if (!('idx1' in eleInfo)) {
          haslog && console.log(1)
          // 没有ele
          if (!('idx1' in resEleInfo)) {
            haslog && console.log(2)
            // 没有resEle，直接成组
            eleGroup.push([element, resEle])
            eleInfo.idx1 = eleGroup.length - 1
            eleInfo.idx2 = 0
            resEleInfo.idx1 = eleGroup.length - 1
            resEleInfo.idx2 = 1
          } else {
            haslog && console.log(3)
            // 有resEle
            if (resEleInfo.leftEles.length > 1) {
              haslog && console.log(4)
              const idx1 = eleIdToInfo[resEleInfo.leftEles[0].id].idx1
              if (resEleInfo.idx1 === idx1) {
                haslog && console.log(5)
                // 相交了，resEle摘出去，element放进去
                eleGroup[idx1].splice(resEleInfo.idx2, 1)
                eleGroup.push([resEle])
                resEleInfo.idx1 = eleGroup.length -1
                resEleInfo.idx2 = 0

                eleGroup[idx1].push(element)
                eleInfo.idx1 = idx1
                eleInfo.idx2 = eleGroup[idx1].length - 1
              } else {
                haslog && console.log(6)
                // 虽然相交，但是resEle已经不在这一侧了，直接把element放进去
                eleGroup[idx1].push(element)
                eleInfo.idx1 = idx1
                eleInfo.idx2 = eleGroup[idx1].length - 1
              }
            } else {
              haslog && console.log(7)
              const idx1 = resEleInfo.idx1
              eleGroup[idx1].push(element)
              eleInfo.idx1 = idx1
              eleInfo.idx2 = eleGroup[idx1].length - 1
            }
          }
        } else {
          haslog && console.log(8)
          // 有ele
          if (!('idx1' in resEleInfo)) {
            haslog && console.log(9)
            // 没有resEle
            if (eleInfo.right <= eleInfo.top || eleInfo.right <= eleInfo.left || eleInfo.right <= eleInfo.bottom) {
              haslog && console.log('9-1')
              haslog && console.log("info", JSON.parse(JSON.stringify({eleInfo, resEleInfo})))
              haslog && console.log("ele", JSON.parse(JSON.stringify({element, resEle})))
              haslog && console.log("", JSON.parse(JSON.stringify(eleGroup)))
              
              eleGroup[eleInfo.idx1].splice(eleInfo.idx2, 1)
              eleGroup.push([element, resEle])
              eleInfo.idx1 = eleGroup.length - 1
              eleInfo.idx2 = 0
              resEleInfo.idx1 = eleGroup.length - 1
              resEleInfo.idx2 = 1
            } else {
              haslog && console.log(10)
              eleGroup.push([resEle])
              resEleInfo.idx1 = eleGroup.length - 1
              resEleInfo.idx2 = 0
            }
          } else {
            haslog && console.log(11)
            // 有resEle
            // TODO: 待观察
            if (eleInfo.right <= eleInfo.top || eleInfo.right <= eleInfo.left || eleInfo.right <= eleInfo.bottom) {
              haslog && console.log(12)
              const resIdx1 = resEleInfo.idx1
              const resIdx2 = resEleInfo.idx2
              const resGroup = eleGroup[resIdx1]
              eleGroup[eleInfo.idx1].splice(eleInfo.idx2, 1)
              eleInfo.idx1 = resIdx1
              if (resIdx2 === 0) {
                resGroup.unshift(element)
              } else {
                resGroup.splice(resIdx2 - 1, 0, element)
              }
              resGroup.forEach((ele, idx2) => {
                eleIdToInfo[ele.id].idx2 = idx2
              })
            } else {
              haslog && console.log(13)
              // debugger
              // 暂时不管，后续要看
            }
          }
        }
      } else if (isY) {
        haslog && console.log(14)
        if (!('idx1' in eleInfo)) {
          haslog && console.log(15)
          // 没有ele
          if (!('idx1' in resEleInfo)) {
            haslog && console.log(16)

            // 没有resEle，直接成组
            eleGroup.push([element, resEle])
            eleInfo.idx1 = eleGroup.length - 1
            eleInfo.idx2 = 0
            resEleInfo.idx1 = eleGroup.length - 1
            resEleInfo.idx2 = 1
          } else {
            haslog && console.log(17)
            // 有resEle
            // debugger
          }
        } else {
          // 有ele
          if (!('idx1' in resEleInfo)) {
            haslog && console.log(18)
            // 没有resEle
            // debugger
            if (resEleInfo.topEles.length > 1) {
              haslog && console.log(19)
              eleGroup.push([resEle])
              resEleInfo.idx1 = eleGroup.length - 1
              resEleInfo.idx2 = 0
            } else {
              haslog && console.log(20)
              // debugger
              if (eleInfo.bottom < eleInfo.top || eleInfo.bottom < eleInfo.left || eleInfo.bottom < eleInfo.right) {
                haslog && console.log(21)
                eleGroup[eleInfo.idx1].splice(eleInfo.idx2, 1)
                eleGroup.push([element, resEle])
                eleInfo.idx1 = eleGroup.length -1
                eleInfo.idx2 = 0
                resEleInfo.idx1 = eleGroup.length -1
                resEleInfo.idx2 = 1
              } else {
                haslog && console.log(22)
                // debugger
              }
            }
          } else {
            haslog && console.log(23)
            // 有resEle
            // debugger
          }
        }
      } else {
        haslog && console.log(24)
        if (!('idx1' in eleInfo)) {
          haslog && console.log(25)
          // 没有element，直接push
          eleGroup.push([element])
          eleInfo.idx1 = eleGroup.length - 1
          eleInfo.idx2 = 0
        } else {
          // 有了，又没有对比，这里不用动
        }
      }
    })

    let newElements = this.convertedToElements(eleGroup)

    // console.log("eleIdToInfo: ", eleIdToInfo)

    if (eleGroup.length === elements.length) {
      return newElements
    } else {
      return this.splitElements(newElements)
    }
  }

  convertedToElements(eleGroup: any) {
    const elements = []

    eleGroup.forEach((group) => {
      const length = group.length
      // console.log("group: ", group.map((i) => i.id))
      if (length) {
        if (length === 1) {
          elements.push(group[0])
        } else if (length > 1) {
          // 找最小的top，最小的left，计算最大的width和height
          let top,left,width,height
          let flexDirection
          let curLeft = 0
          let curTop = 0
          // console.log(":group", group.map((i) => i.id))
          // group.sort((pre, cur) => {
          //   if (pre.top === cur.top) {
          //     return pre.left - cur.left
          //   }
          //   return pre.top - cur.top
          // })
          group.forEach((ele) => {
            if (typeof top !== 'number' || top > ele.top) {
              top = ele.top
            }
            if (typeof left !== 'number' || left > ele.left) {
              left = ele.left
            }
            if (typeof width !== 'number' || width < ele.width + ele.left) {
              width = ele.width + ele.left
            }
            if (typeof height !== 'number' || height < ele.height + ele.top) {
              height = ele.height + ele.top
            }

            if (ele.top >= curTop) {
              flexDirection = 'column'
            } else if (ele.left >= curLeft) {
              flexDirection = 'row'
            }
           

            // if (curLeft <= ele.left) {
            //   flexDirection = 'row'
            // }
            curLeft = ele.left + ele.width
            curTop = ele.top + ele.height
          })

          elements.push({
            // 方便看数据，后续去掉
            id: group.map((i) => i.id).join(),
            top,
            left,
            width: width - left,
            height: height - top,
            flexDirection: flexDirection || 'column',
            elements: group.map((g) => {
              return {
                ...g,
                parentFlexDirection: flexDirection || 'column',
              }
            })
          })
        }
      }
    })

    return elements
  }
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