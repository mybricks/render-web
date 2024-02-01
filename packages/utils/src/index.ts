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
    const eleGroup = this.splitElements2(this.handleIntersectionsAndInclusions(elements))
    return this.handleEleGroup(eleGroup, { top: 0, left: 0 })
  }

  handleEleGroup(elements, { top: pTop, left: pLeft }) {
    const resEles: any = []
    let curTop = pTop
    let curLeft = pLeft

    if (elements.length === 1) {
      const ele = elements[0]
      const resEle: any = {
        ...ele,
        marginTop: ele.top - curTop,
        marginLeft: ele.left - curLeft
      }
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
        resEle.marginLeft = ele.left - curLeft
        resEle.marginTop = ele.top - curTop

        if (Array.isArray(ele.elements)) {
          resEle.elements = this.handleEleGroup(ele.elements, {
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

    return resEles
  }

  handleIntersectionsAndInclusions(elements: any) {
    // 处理包含和相交关系
    return elements
  }

  /**
   * 是否相交
   * - 是 true
   * - 否 false
   */
  checkRightIntersects(elements, ele, value) {
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.rightEle = cEle
        value.rightSpace = cEle.left - (ele.left + ele.width)
      }
      
      return false
    } else {
      elements.sort((pre, cur) => {
        return pre.left - cur.left
      })
      const right1Ele = elements[0]
      const right2Ele = elements[1]

      if (right1Ele.left + right1Ele.width > right2Ele.left) {
        value.rightEle = right1Ele
        value.rightSpace = right1Ele.left - (ele.left + ele.width)
        return true
      }
      value.rightEle = right1Ele
      value.rightSpace = right1Ele.left - (ele.left + ele.width)
      return false
    }
  }

   /**
   * 是否相交
   * - 是 true
   * - 否 false
   */
  checkBottomIntersects(elements, ele, value) {
    // 全量对比版本
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.bottomEle = cEle
        value.bottomSpace = cEle.top - (ele.top + ele.height)
      }
      return false
    } else {
      elements.sort((pre, cur) => {
        return pre.top - cur.top
      })
      const top1Ele = elements[0]
      const top2Ele = elements[1]

      if (top1Ele.top + top1Ele.height > top2Ele.top) {
        value.bottomEle = top1Ele
        value.bottomSpace = top1Ele.top - (ele.top + ele.height)
        return true
      } 
      value.bottomEle = top1Ele
      value.bottomSpace = top1Ele.top - (ele.top + ele.height)
      return false
    }
  }

  checkTopIntersects(elements, ele, value) {
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.topEle = cEle
        value.topSpace = ele.top - (cEle.top + cEle.height)
      }
      return false
    } else {
      elements.sort((pre, cur) => {
        return  (cur.top + cur.height) - (pre.top + pre.height)
      })
      const top1Ele = elements[0]
      const top2Ele = elements[1]

      if (top2Ele.top + top2Ele.height > top1Ele.top) {
        value.topEle = top1Ele
        value.topSpace = ele.top - (top1Ele.top + top1Ele.height)
        return true
      }
      value.topEle = top1Ele
      value.topSpace = ele.top - (top1Ele.top + top1Ele.height)
      return false
    }
  }

  checkLeftIntersects(elements, ele, value) {
    const length = elements.length

    if (!length || length === 1) {
      const cEle = elements[0]
      if (cEle) {
        value.leftEle = cEle
        value.leftSpace = ele.left - (cEle.left + cEle.width)
      }
      return false
    } else {
      elements.sort((pre, cur) => {
        return (cur.left + cur.width) - (pre.left + pre.width)
      })
      const top1Ele = elements[0]
      const top2Ele = elements[1]

      if (top2Ele.left + top2Ele.width > top1Ele.left) {
        value.leftEle = top1Ele
        value.leftSpace = ele.left - (top1Ele.left + top1Ele.width)
        return true
      }
      value.leftEle = top1Ele
      value.leftSpace = ele.left - (top1Ele.left + top1Ele.width)
      return false
    }
  }

  handleAdjacent(elements) {
    const eleIdToInfo = {}
    const eleIdMap = {}
    elements.forEach((ele => {
      eleIdMap[ele.id] = ele
      const rightEles = []
      const bottomEles = []

      const haslog = false

      for (let i = 0; i < elements.length; i++) {
        const cEle = elements[i]
        if (!eleIdToInfo[cEle.id]) {
          eleIdToInfo[cEle.id] = {
            topEles: [],
            leftEles: [],
            rightEles: [],
            bottomEles: []
          }
        }

        if (ele.id !== cEle.id) {
          const break1 = cEle.left >= ele.left + ele.width && cEle.top >= ele.top + ele.height
          // 被对比的在右下角就不用管了
          if (break1) {
            // break
          }
          if (break1 || (cEle.left + cEle.width <= ele.left || cEle.top + cEle.height <= ele.top)) {

          } else {
           
            // 先看是上下还是左右
            if (cEle.top >= ele.top + ele.height) {
              // 上下对比
              // 找是否有相同区间的
              let sLeft = 0
              let mWidth = 0
              const { left: cLeft, width: cWidth } = cEle
              // let sIdx = -1
              // bottomEles.forEach(({left, width}, idx) => {
              //   if (left < sLeft) {
              //     sLeft = left
              //   }
              //   if (mWidth < left + width) {
              //     mWidth = left + width
              //   }
                
              //   if ((cLeft >= left && cLeft < left + width) || (cLeft + cWidth <= left + width && cLeft + cWidth > left)) {
              //     sIdx = idx
              //     // return true
              //   }
              //   // return false
              // })

              // if (sIdx === -1) {
              //   if (cEle.id === 'J') {
              //     console.log("检测上下左右,", cEle.id, ele.id, sIdx, JSON.parse(JSON.stringify(bottomEles)))
              //     console.log({sLeft, mWidth})
              //   }
  
              //   // 说明没有相交的，当前下侧直接push
              //   bottomEles.push(cEle)
              //   // 向被对比的上侧添加
              //   eleIdToInfo[cEle.id].topEles.push(ele)
              //   // TODO:看是否考虑在这里就把关系做好
              // } else {
              //   // sIdx 说明相交了，对比top，看谁更近
              //   const sEle = bottomEles[sIdx]
              //   if (cEle.top < sEle.top) {
              //     // 当前更小，替换
              //     bottomEles.splice(sIdx, 1, cEle)
              //     // 向被对比的上侧添加
              //     eleIdToInfo[cEle.id].topEles.push(ele)
              //     // 把相同的上侧删除当前元素
              //     const sEleTopEles = eleIdToInfo[sEle.id].topEles
              //     const sEleTopIdx = sEleTopEles.findIndex((e) => e.id === ele.id)
              //     if (sEleTopIdx !== -1) {
              //       sEleTopEles.splice(sEleTopIdx, 1)
              //     }
              //   } else {
              //     // 当前更大，不做处理
              //   }
              // }

              if (!bottomEles.length) {
                // 没有，直接push
                bottomEles.push(cEle)
                eleIdToInfo[cEle.id].topEles.push(ele)
              } else {
                const hasNoPush = bottomEles.some(({left, width}) => {
                  return (cEle.left >= left && cEle.left <= left + width) || 
                    (cEle.left + cEle.width >= left && cEle.left + cEle.width <= left + width) ||
                    (left >= cEle.left && left <= cEle.left + cEle.width) ||
                    (left + width >= cEle.left && left + width <= cEle.left + cEle.width)
                })

                if (!hasNoPush) {
                  bottomEles.push(cEle)
                  eleIdToInfo[cEle.id].topEles.push(ele)
                }
              }

             



            } else {
              // 左右对比
              // console.log("左右对比: ", ele.id, cEle.id)
              // 找是否有相同区间的
              const sIdx = rightEles.findIndex(({top, height}) => {
                const { top: cTop, height: cHeight } = cEle
                if ((cTop >= top && cTop < top + height) || (cTop + cHeight <= top + height && cTop + cHeight > top)) {
                  return true
                }
                return false
              })

              if (sIdx === -1) {
                // 说明没有相交的，当前右侧直接push
                rightEles.push(cEle)
                // 向被对比的左侧添加
                eleIdToInfo[cEle.id].leftEles.push(ele)
                // TODO:看是否考虑在这里就把关系做好
              } else {
                // sIdx 说明相交了，对比left，看谁更近
                const sEle = rightEles[sIdx]
                if (cEle.left < sEle.left) {
                  // 当前更小，替换
                  rightEles.splice(sIdx, 1, cEle)
                  // 向被对比的左侧添加
                  eleIdToInfo[cEle.id].leftEles.push(ele)
                  // 把相同的左侧删除当前元素
                  const sEleLeftEles = eleIdToInfo[sEle.id].leftEles
                  const sEleLeftIdx = sEleLeftEles.findIndex((e) => e.id === ele.id)
                  if (sEleLeftIdx !== -1) {
                    sEleLeftEles.splice(sEleLeftIdx, 1)
                  }
                } else {
                  // 当前更大，不做处理
                  haslog && console.log(9988)
                }
              }
            }
          }
        }
      }

      eleIdToInfo[ele.id].rightEles = rightEles
      eleIdToInfo[ele.id].bottomEles = bottomEles
    }))

    Object.entries(eleIdToInfo).forEach(([key, value]: any) => {
      // console.log("key: ", key)
      value.rightIntersect = this.checkRightIntersects(value.rightEles, eleIdMap[key], value)
      value.bottomIntersect = this.checkBottomIntersects(value.bottomEles, eleIdMap[key], value)
      value.topIntersect = this.checkTopIntersects(value.topEles, eleIdMap[key], value)
      value.leftIntersect = this.checkLeftIntersects(value.leftEles, eleIdMap[key], value)
    })

    return eleIdToInfo
  }


  newSplitElements({elements, eleIdToInfo}) {
    const intersectMap = {
      bottomSpace: 'bottomIntersect',
      topSpace: 'topIntersect',
      leftSpace: 'leftIntersect',
      rightSpace: 'rightIntersect',
    }
    const eleMap = {
      bottomSpace: 'bottomEle',
      topSpace: 'topEle',
      leftSpace: 'leftEle',
      rightSpace: 'rightEle',
    }
    const eleGroup = []
    const eleIdToPosition = {}

    function sortEles({ele, eleInfo, fEle, fEleInfo, direction}) {
      let eles
      let idxMap = {}
      let space
      let comparable = true

      if (direction === 'bottomSpace') {
        // 说明fEle在ele下面
        eles = [ele, fEle]
        idxMap[ele.id] = 0
        idxMap[fEle.id] = 1
        space = fEle.top - (ele.top + ele.height)
        comparable = !fEleInfo.topIntersect
      } else if (direction === 'bottomSpace') {
        // 说明fEle在ele上面
        eles = [fEle, ele]
        idxMap[fEle.id] = 0
        idxMap[ele.id] = 1
        space = ele.top - (fEle.top + fEle.height)
        comparable = !fEleInfo.topIntersect
      } else if (direction === 'leftSpace') {
        // 说明fEle在ele左面
        eles = [fEle, ele]
        idxMap[fEle.id] = 0
        idxMap[ele.id] = 1
        space = ele.left - (fEle.left + fEle.width)
        comparable = !fEleInfo.rightIntersect
      } else if (direction === 'rightSpace') {
        // 说明fEle在ele右面
        eles = [ele, fEle]
        idxMap[ele.id] = 0
        idxMap[fEle.id] = 1
        space = fEle.left - (ele.left + ele.width)
        comparable = !fEleInfo.leftIntersect
      }
      
      return {
        eles,
        idxMap,
        space,
        comparable
      }
    }

    elements.forEach((ele) => {
      const eleInfo = eleIdToInfo[ele.id]
      const spaceAry = ['bottomSpace', 'topSpace', 'leftSpace', 'rightSpace'].filter((key) => {
        if (eleInfo.hasOwnProperty(key)) {
          return true
        }
      }).sort((p, c) => {
        return eleInfo[p] - eleInfo[c]
      })
      if (!spaceAry.length) {
        eleGroup.push([ele])
        eleIdToPosition[ele.id] = {
          idx1: eleGroup.length - 1,
          idx2: 0
        }
      } else {
        let isBreak = false
        const elePo = eleIdToPosition[ele.id]
        for (let i = 0; i < spaceAry.length; i++) {
          const key = spaceAry[i]
          const intersect = eleInfo[intersectMap[key]]
          const fEle = eleInfo[eleMap[key]]
          const fElePo = eleIdToPosition[fEle.id]
          const fEleInfo = eleIdToInfo[fEle.id]

          if (!intersect) {
            // 没有相交
            if (!elePo) {
              // 没有当前
              if (!fElePo) {
                // 没有被对比
                console.log(`✅ 没有相交 没有-当前${ele.id} 没有-被对比${fEle.id}`) // 直接push合并即可
                const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})

                if (comparable) {
                  eleGroup.push(eles)
                  eleIdToPosition[ele.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: idxMap[ele.id]
                  }
                  eleIdToPosition[fEle.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: idxMap[fEle.id]
                  }
                  isBreak = true
                  break
                }
              } else {
                const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})
                if (comparable) {
                  if (space < fElePo.space) {
                    console.log(`✅ 没有相交 间距更小 没有-当前${ele.id} 有-被对比${fEle.id}`)
                    // 删除被对比
                    eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                    // 和被对比成组
                    eleGroup.push(eles)
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[ele.id]
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[fEle.id]
                    }
                    isBreak = true
                    break
                  } else {
                    // 间距更大，忽略
                  }
                }
              }
            } else {
              if (!fElePo) {
                // 没有被对比
                const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})
                if (comparable) {
                  if (space < elePo.space) {
                    console.log(`✅ 没有相交 间距更小 有-当前${ele.id} 没有-被对比${fEle.id}`)
                    // 删除当前
                    eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                    // 和被对比成组
                    eleGroup.push(eles)
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[ele.id]
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: idxMap[fEle.id]
                    }
                    isBreak = true
                    break
                  } else {
                    // 间距更大，忽略
                  }
                }
              } else {
                // 有被对比
                if (elePo.idx1 === fElePo.idx1) {
                  // 在同一组
                  isBreak = true
                  break
                } else {
                  const { eles, idxMap, space, comparable } = sortEles({ele, eleInfo, fEle, fEleInfo, direction: key})
                  if (comparable) {
                    if (space < fElePo.space) {
                      console.log(`✅ 没有相交 间距更小 有-当前${ele.id} 有-被对比${fEle.id}`)
                      // 删除被对比
                      eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                      // 和被对比成组
                      eleGroup.push(eles)
                      eleIdToPosition[ele.id] = {
                        space,
                        idx1: eleGroup.length - 1,
                        idx2: idxMap[ele.id]
                      }
                      eleIdToPosition[fEle.id] = {
                        space,
                        idx1: eleGroup.length - 1,
                        idx2: idxMap[fEle.id]
                      }
                      isBreak = true
                      break
                    } else {
                      // 间距更大，忽略
                    }
                  }
                }
              }
            }
          } else {
            // 相交的话直接忽略即可
          }
        }
        if (!isBreak) {
          console.log(`✅ 单独 ${ele.id}`)
          eleGroup.push([ele])
          eleIdToPosition[ele.id] = {
            idx1: eleGroup.length - 1,
            idx2: 0
          }
        }
      }
    })

    return eleGroup
  }

  // 拆分2
  splitElements2(elements: any) {
    const eleIdToInfo = this.handleAdjacent(elements.sort((pre, cur) => {
      if (pre.top === cur.top) {
        return pre.left - cur.left
      }
      return pre.top - cur.top
    }))

    const eleGroup = this.newSplitElements({elements: elements.sort((pre, cur) => {
      if (pre.top === cur.top) {
        return pre.left - cur.left
      }
      return pre.top - cur.top
    }), eleIdToInfo})


    let newElements = this.convertedToElements(eleGroup)
    if (newElements.length > 1) {
      return this.splitElements2(newElements)
    }

    return newElements
  }

  // 拆分
  splitElements(elements: any) {
    // const eleIdToInfo = {}
    const eleGroup = []
    const eleIdToPosition = {}

    const eleIdToInfo = this.handleAdjacent(elements.sort((pre, cur) => {
      // if (!eleIdToPosition[cur.id]) {
      //   eleIdToPosition[cur.id] = {}
      // }
      // if (!eleIdToPosition[pre.id]) {
      //   eleIdToPosition[pre.id] = {}
      // }
      if (pre.top === cur.top) {
        return pre.left - cur.left
      }
      return pre.top - cur.top
    }))

    const haslog = (elements.length === 18) && false

    if (elements.length === 18) {
      
      this.newSplitElements({elements, eleIdToInfo})
    }

    haslog && console.log("当前elements: ", elements)
    haslog && console.log("当前eleIdToInfo: ", eleIdToInfo)

    const easyIdToInfo = {}
    Object.entries(eleIdToInfo).forEach(([key, value]: any) => {
      easyIdToInfo[key] = {
        ...value,
        topEles: value.topEles.map((e) => e.id),
        leftEles: value.leftEles.map((e) => e.id),
        rightEles: value.rightEles.map((e) => e.id),
        bottomEles: value.bottomEles.map((e) => e.id),
      }
    })

    haslog && console.log("easyIdToInfo: ", easyIdToInfo)

    // haslog && console.log("eleIdToInfo: ", JSON.parse(JSON.stringify(eleIdToInfo)))

    elements.forEach((ele) => {
      haslog && console.log("当前id: ", ele.id)
      // const haslog = elements.length === 4 && ele.id === 'B'
      const eleId = ele.id
      const eleInfo = eleIdToInfo[eleId]
      const elePo = eleIdToPosition[eleId]
      // 打印的开关

      if (eleInfo.rightIntersect || eleInfo.bottomIntersect) {
        // 任意一边相交都单独拆分
        haslog && console.log(1)

        if (eleInfo.rightIntersect) {
          haslog && console.log(73, "右边相交 和下边比")
          const fEle = eleInfo.bottomEles.reduce((res, ele) => {
            if (!res) {
              return ele
            } else {
              if (res.top < ele.top) {
                return res
              }
              return ele
            }
          }, null)
          if (fEle) {
            haslog && console.log(87, "没处理")
          } else {
            haslog && console.log(88)

            if (!elePo) {
              // 没有当前，直接push
              haslog && console.log(102)
              eleGroup.push([ele])
              eleIdToPosition[ele.id] = {
                idx1: eleGroup.length - 1,
                idx2: 0
              }
            } else {
              // 有当前
              haslog && console.log(103, "没处理")
            }

          }

        } else if (eleInfo.bottomIntersect) {
          haslog && console.log(74, "下边相交 和右边比")
          const fEle = eleInfo.rightEles.reduce((res, ele) => {
            if (!res) {
              return ele
            } else {
              if (res.left < ele.left) {
                return res
              }
              return ele
            }
          }, null)
          if (fEle) {
            haslog && console.log(75)
            const fElePo = eleIdToPosition[fEle.id]
            const fEleInfo = eleIdToInfo[fEle.id]
            if (!elePo) {
              // 没有当前
              haslog && console.log(79)
              if (!fElePo) {
                // 没有被对比
                haslog && console.log(81, "没处理")
              } else {
                // 有被对比
                haslog && console.log(82)
                const space = fEle.left - (ele.left + ele.width)

                if (typeof fElePo.space !== 'number') {
                  haslog && console.log(83, "没处理")
                  

                  if (fEleInfo.leftIntersect) {
                    haslog && console.log(94)
                    // 左相交，直接push当前即可
                    eleGroup.push([ele])
                    eleIdToPosition[ele.id] = {
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                  } else {
                    haslog && console.log(95, "没有处理")
                  }
                } else {
                  haslog && console.log(84)
                  if (space <= fElePo.space) {
                    haslog && console.log(85)
                    // 相等的话默认横向
                    // 删除被对比，
                    eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                    eleGroup[fElePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    // 当前和被对比成组
                    eleGroup.push([ele, fEle])
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 1
                    }
                  } else {
                    haslog && console.log(86, "没处理")
                  }
                }

              }
             } else {
              // 有当前
              haslog && console.log(80, "没处理")
            }
          } else {
            // 右边没有，不做对比了
            haslog && console.log(76)
            if (!elePo) {
              // 没有当前，直接push
              haslog && console.log(77)
              eleGroup.push([ele])
              eleIdToPosition[ele.id] = {
                idx1: eleGroup.length - 1,
                idx2: 0
              }
            } else {
              // 有当前
              haslog && console.log(78, "没处理")
            }
            
          }
        }
      } else if (eleInfo.rightIntersect && eleInfo.bottomIntersect) {
        console.log("两边都相交单独拆分")
      } else {
        const rightEle = eleInfo.rightEles.reduce((res, ele) => {
          if (!res) {
            return ele
          } else {
            if (res.left < ele.left) {
              return res
            }
            return ele
          }
        }, null)

        const bottomEle = eleInfo.bottomEles.reduce((res, ele) => {
          if (!res) {
            return ele
          } else {
            if (res.top < ele.top) {
              return res
            }
            return ele
          }
        }, null)

        /**
         * 最终被对比的ele
         */
        let fEle

        if (rightEle && bottomEle) {
          haslog && console.log(1)
          if ((rightEle.left - (ele.left + ele.width)) < bottomEle.top - (ele.top + ele.height)) {
            haslog && console.log(20)
            fEle = rightEle
            const fEleInfo = eleIdToInfo[fEle.id]
            const fElePo = eleIdToPosition[fEle.id]
            // 对比右方
            if (!elePo) {
              // 没有当前
              haslog && console.log(34)
              if (!fElePo) {
                haslog && console.log(36)
                // 没有被对比，两个直接成组
                eleGroup.push([ele, fEle])

                const space = fEle.left - (ele.left + ele.width)
                
                eleIdToPosition[ele.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 0
                }
                eleIdToPosition[fEle.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 1
                }
              } else {
                // 有被对比
                haslog && console.log(37)
                

                  // fEleInfo.leftEles.length > 1
                if (fEleInfo.leftIntersect) {
                  haslog && console.log(57)
                  debugger
                  // 相交的
                  if (!fElePo) {
                    haslog && console.log(58, "还没处理")
                  } else {
                    haslog && console.log(59)
                    
                    // // 删除当前
                    // // 删除被对比
                    const idx1 = fElePo.idx1
                    const cEleGroup = eleGroup[idx1]
                    cEleGroup.splice(fElePo.idx2, 1)
                    eleGroup.push([fEle])
                    fElePo.idx1 = eleGroup.length - 1
                    fElePo.idx2 = 0
  
                    const idx2 = cEleGroup.findIndex((i) => i.top >= ele.top + ele.height)
                    haslog && console.log(ele, JSON.parse(JSON.stringify(cEleGroup)))
                    if (idx2 === 0) {
                      cEleGroup.unshift(ele)
                    } else if (idx2 === -1) {
                      cEleGroup.push(ele)
                    } else {
                      cEleGroup.splice(idx2 - 1, 0, ele)
                    }
                    cEleGroup.forEach((ele, idx2) => {
                      eleIdToPosition[ele.id].idx2 = idx2
                    })
                  
                  }
                } else {
                  haslog && console.log(68)
                  const space = fEle.left - (ele.left + ele.width)
                  if (fElePo.space) {
                    haslog && console.log(69)
                    

                    if (space < fElePo.space) {
                      // 间距更小
                      haslog && console.log(45)
                      // 删除被对比
                      eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                      eleGroup[fElePo.idx1].forEach((ele, idx) => {
                        eleIdToPosition[ele.id].idx2 = idx
                      })
                      eleGroup.push([ele, fEle])
                      eleIdToPosition[ele.id] = {
                        space,
                        idx1: eleGroup.length - 1,
                        idx2: 0
                      }
                      eleIdToPosition[fEle.id] = {
                        space,
                        idx1: eleGroup.length - 1,
                        idx2: 1
                      }
                    } else {
                      haslog && console.log(42, "还没处理", "间距更大")
                     
                    }
                  } else {
                    // 被对比没有间距自成一组的，直接合并两个
                    haslog && console.log(70)
             
                     // 删除被对比
                     eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                     eleGroup[fElePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                     eleGroup.push([ele, fEle])
                     eleIdToPosition[ele.id] = {
                       space,
                       idx1: eleGroup.length - 1,
                       idx2: 0
                     }
                     eleIdToPosition[fEle.id] = {
                       space,
                       idx1: eleGroup.length - 1,
                       idx2: 1
                     }
                  }

                }
              }
            } else {
              // 有当前
              haslog && console.log(35)
              if (!fElePo) {
                // 没有被对比
                haslog && console.log(38)

                const space = fEle.left - (ele.left + ele.width)

                if (typeof elePo.space !== 'number') {
                  // 删除原来的
                  eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                  eleGroup[elePo.idx1].forEach((ele, idx) => {
                    eleIdToPosition[ele.id].idx2 = idx
                  })
                  // 合并当前和被对比
                  eleGroup.push([ele, fEle])
                  eleIdToPosition[ele.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: 0
                  }
                  eleIdToPosition[fEle.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: 1
                  }
                } else {
                  haslog && console.log(105)
                  if (space < elePo.space) {
                    // 间距更小，成组
                    haslog && console.log(60, '还没处理')
                  } else {
                    // 间距更大，直接push被对比
                    haslog && console.log(61)
                    eleGroup.push([fEle])
                    eleIdToPosition[fEle.id] = {
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                  }
                }


              } else {
                // 有被对比
                haslog && console.log(39, `重点处理这里，有${ele.id}, 有${fEle.id}`)
               
                
              }
            }
          
          } else {
            // const haslog = false
            // 对比下方
            haslog && console.log(21)
            fEle = bottomEle
            const fEleInfo = eleIdToInfo[fEle.id]
            const fElePo = eleIdToPosition[fEle.id]
            if (!elePo) {
              // 没有当前
              haslog && console.log(22)
              if (!fElePo) {
                // 没有被对比，两个直接成组
                haslog && console.log(27, ele, fEle)

                if (fEleInfo.topIntersect) {
                  haslog && console.log(104)
                  eleGroup.push([ele])
                  eleIdToPosition[ele.id] = {
                    idx1: eleGroup.length - 1,
                    idx2: 0
                  }
                } else {
                  eleGroup.push([ele, fEle])

                  const space = fEle.top - (ele.top + ele.height)
                  eleIdToPosition[ele.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: 0
                  }
                  eleIdToPosition[fEle.id] = {
                    space,
                    idx1: eleGroup.length - 1,
                    idx2: 1
                  }
                }

                

              
              } else {
                // 有被对比
                haslog && console.log(28)
                // fEleInfo.topEles.length > 1
                if (fEleInfo.topIntersect) {
                  haslog && console.log(30)
                  // 相交的
                  if (!fElePo) {
                    haslog && console.log(31, "还没处理")
                  } else {
                    haslog && console.log(32)
                    // 删除当前
                    // 删除被对比
                    const idx1 = fElePo.idx1
                    const cEleGroup = eleGroup[idx1]
                    cEleGroup.splice(fElePo.idx2, 1)
                    eleGroup.push([fEle])
                    fElePo.idx1 = eleGroup.length - 1
                    fElePo.idx2 = 0
  
                    const idx2 = cEleGroup.findIndex((i) => i.left >= ele.left + ele.width)
                    if (idx2 === -1) {
                      // debugger
                      console.log("出问题111")
                    } else if (idx2 === 0) {
                      cEleGroup.unshift(ele)
                    } else {
                      cEleGroup.splice(idx2 - 1, 0, ele)
                    }
                    cEleGroup.forEach((ele, idx2) => {
                      eleIdToPosition[ele.id].idx2 = idx2
                    })
                  }
                } else {
                  haslog && console.log(33, "没有处理")
                }
              }

            } else {
              // 有当前
              haslog && console.log(23)

              // fEleInfo.topEles.length > 1
              if (fEleInfo.topIntersect) {
                haslog && console.log(24, "还没处理")
                // 相交的
                if (!fElePo) {
                  haslog && console.log(25, "还没处理")
                } else {
                  haslog && console.log(26)
                  // 删除当前
                  eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                  eleGroup[elePo.idx1].forEach((ele, idx) => {
                    eleIdToPosition[ele.id].idx2 = idx
                  })
                  // 删除被对比
                  const idx1 = fElePo.idx1
                  const cEleGroup = eleGroup[idx1]
                  cEleGroup.splice(fElePo.idx2, 1)
                  eleGroup.push([fEle])
                  fElePo.idx1 = eleGroup.length - 1
                  fElePo.idx2 = 0

                  const idx2 = cEleGroup.findIndex((i) => i.left >= ele.left + ele.width)
                  if (idx2 === -1) {
                    console.log("出问题222")
                  } else if (idx2 === 0) {
                    cEleGroup.unshift(ele)
                  } else {
                    cEleGroup.splice(idx2 - 1, 0, ele)
                  }
                  cEleGroup.forEach((ele, idx2) => {
                    eleIdToPosition[ele.id].idx2 = idx2
                  })
                }
              } else {
                haslog && console.log(29)
                // 上面没有相交
                if (!fElePo) {
                  // 没有对比
                  haslog && console.log(49)

                  const space = fEle.top - (ele.top + ele.height)

                  if (space < elePo.space) {
                    haslog && console.log(51)

                    // 删除当前，合并当前和对比
                    eleGroup[elePo.idx1].splice(elePo.idx2)
                    eleGroup[elePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    eleGroup.push([ele, fEle])
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 1
                    }
                  } else {
                    haslog && console.log(52, "没处理", `有${ele.id} 没有${fEle.id}`)
                  }


                 
                } else {
                  // 有对比
                  haslog && console.log(50, "没处理")
                
                }
                
               
              }

            }
          }
          // fEle = (rightEle.left - (ele.left + ele.width)) < (bottomEle.top - (bottomEle.top + bottomEle.height)) ? rightEle : bottomEle
        } else if (rightEle) {
          // const haslog = false
          // 只有右边
          haslog && console.log(2)
          fEle = rightEle
          const fElePo = eleIdToPosition[fEle.id]
          const fEleInfo = eleIdToInfo[fEle.id]

          if (!elePo) {
            // 没有当前
            haslog && console.log(3)
            if (!fElePo) {
              // 没有被对比
              haslog && console.log(4)
              // 右边的也没有，直接push
              eleGroup.push([ele, fEle])
              const space = fEle.left - (ele.left + ele.width)
              eleIdToPosition[ele.id] = {
                space,
                idx1: eleGroup.length - 1,
                idx2: 0
              }
              eleIdToPosition[fEle.id] = {
                space,
                idx1: eleGroup.length - 1,
                idx2: 1
              }
            } else {
              // 有被对比
              haslog && console.log(5)

              const space = fEle.left - (ele.left + ele.width)

              if (typeof fElePo.space !== 'number') {
                haslog && console.log(46)
                // 删除原来的
                eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                eleGroup[fElePo.idx1].forEach((ele, idx) => {
                  eleIdToPosition[ele.id].idx2 = idx
                })
                // 合并当前和被对比
                eleGroup.push([ele, fEle])
                eleIdToPosition[ele.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 0
                }
                eleIdToPosition[fEle.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 1
                }
              } else {
                haslog && console.log(52)

                // fEleInfo.leftEles.length > 1
                if (fEleInfo.leftIntersect) {
                  // debugger
                  haslog && console.log(53, '重点看这里', fEleInfo, fEle.id)
                  // 相交的
                  if (!fElePo) {
                    haslog && console.log(55, "还没处理")
                  } else {
                    haslog && console.log(56)
                    // // 删除当前
                    // // 删除被对比
                    const idx1 = fElePo.idx1
                    const cEleGroup = eleGroup[idx1]
                    cEleGroup.splice(fElePo.idx2, 1)
                    eleGroup.push([fEle])
                    fElePo.idx1 = eleGroup.length - 1
                    fElePo.idx2 = 0
  
                    const idx2 = cEleGroup.findIndex((i) => i.top >= ele.top + ele.height)
                    haslog && console.log(ele, JSON.parse(JSON.stringify(cEleGroup)))
                    if (idx2 === 0) {
                      cEleGroup.unshift(ele)
                    } else if (idx2 === -1) {
                      cEleGroup.push(ele)
                    } else {
                      cEleGroup.splice(idx2 - 1, 0, ele)
                    }
                    cEleGroup.forEach((ele, idx2) => {
                      eleIdToPosition[ele.id].idx2 = idx2
                    })
                  
                  }
                } else {
                  haslog && console.log(54)
                  if (space < fElePo.space) {
                    // 间距更小
                    haslog && console.log(40)
                    // 删除被对比
                    eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                    eleGroup[fElePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    eleGroup.push([ele, fEle])
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 1
                    }
                  } else {
                    // 间距更大？
                    haslog && console.log(41, "还没处理", `没有${ele.id}， 有${fEle.id}`, fElePo.space)
                   
                    eleGroup.push([ele])
                    eleIdToPosition[ele.id] = {
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                 
                  }
                }
              }

            

            }
          } else {
            // 有当前
            haslog && console.log(6)

            if (fEleInfo.leftIntersect) {
              // 不做处理
              haslog && console.log(66, "左边相交的，被对比本来就是单独一行")
            } else {
              haslog && console.log(67)

              // 当前对比间距
              const space = fEle.left - (ele.left + ele.width)

              if (typeof elePo.space === 'number') {
                haslog && console.log(62)
                if (space < elePo.space) {
                  // 间距更小
                  haslog && console.log(7)
                  
                  if (!fElePo) {
                    // 没有被对比
                    haslog && console.log(47, "还没处理", "有", ele.id, "没有", fEle.id)
                    // 删除当前，和被对比合并
                    eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                    eleGroup[elePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    eleGroup.push([ele, fEle])
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 1
                    }
                  } else {
                    // 有被对比
                    haslog && console.log(48)
                    // 删除当前和被对比
                    eleGroup[elePo.idx1].splice(elePo.idx2, 1)
                    eleGroup[elePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    eleGroup[fElePo.idx1].splice(fElePo.idx2, 1)
                    eleGroup[fElePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    // 合并
                    eleGroup.push([ele, fEle])
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 1
                    }
                  }
                  
                } else {
                  // 距离更大
                  haslog && console.log(8)
                  if (!fElePo) {
                    // 没有被对比
                    haslog && console.log(9)
                    // 右边没有，直接push
                    eleGroup.push([fEle])
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                  } else {
                    // 有被对比
                    haslog && console.log(10, "还没处理", `有当前${ele.id}，有对比${fEle.id}`)
                  }
                }
              } else {
                // 没有距离，两个直接成组
                haslog && console.log(63)
                if (!fElePo) {
                  // 没有被对比
                  haslog && console.log(64)
                  const idx1 = elePo.idx1
                  eleGroup[idx1].push(fEle)
                  elePo.space = space
                  eleIdToPosition[fEle.id] = {
                    space,
                    idx1,
                    idx2: eleGroup[idx1].length - 1
                  }
                } else {
                  // 有被对比
                  haslog && console.log(65, "没有处理")
                }
              }
            }
          }
        } else if (bottomEle) {
          // const haslog = false
          haslog && console.log(11)
          fEle = bottomEle
          const fElePo = eleIdToPosition[fEle.id]
          const fEleInfo = eleIdToInfo[fEle.id]

          if (!elePo) {
            // 没有当前
            haslog && console.log(12)
            if (!fElePo) {
              // 没有被对比
              haslog && console.log(13, ele.id, fEle.id)

              if (eleInfo.leftIntersect) {
                haslog && console.log(71, "注意观察")
                eleGroup.push([ele])
                eleIdToPosition[ele.id] = {
                  idx1: eleGroup.length - 1,
                  idx2: 0
                }
                eleGroup.push([fEle])
                eleIdToPosition[fEle.id] = {
                  idx1: eleGroup.length - 1,
                  idx2: 0
                }
              } else {
                haslog && console.log(72)
                // 下边的也没有，直接push
                eleGroup.push([ele, fEle])
                const space = fEle.top - (ele.top + ele.height)
                eleIdToPosition[ele.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 0
                }
                eleIdToPosition[fEle.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 1
                }
              }


            } else {
              // 有被对比
              haslog && console.log(14, '还没处理')
            }
          } else {
            // 有当前
            haslog && console.log(15)
            // 当前对比间距
            const space = fEle.top - (ele.top + ele.height)
            if (space < elePo.space) {
              // 间距更小
              if (!fElePo) {
                // 没有被对比
                haslog && console.log(16)
                
                if (typeof elePo.space !== 'number') {
                  haslog && console.log(90, '没有处理')
                } else {
                  haslog && console.log(91)
                  const space = fEle.top - (ele.top + ele.height)

                  if (space < elePo.space) {
                    haslog && console.log(92)
                    // 间距更小，删除原来的，这俩合并
                    eleGroup[elePo.idx1].splice(elePo.idx2)
                    eleGroup[elePo.idx1].forEach((ele, idx) => {
                      eleIdToPosition[ele.id].idx2 = idx
                    })
                    eleGroup.push([ele, fEle])
                    eleIdToPosition[ele.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 0
                    }
                    eleIdToPosition[fEle.id] = {
                      space,
                      idx1: eleGroup.length - 1,
                      idx2: 1
                    }
                  } else {
                    haslog && console.log(93, "还没处理")
                  }
                }
                

              } else {
                // 有被对比
                haslog && console.log(89, '没有处理')
              }
             
            } else {
              haslog && console.log(7)
              if (!fElePo) {
                // 没有被对比
                haslog && console.log(18)
                // 下边没有，直接push
                eleGroup.push([fEle])
                eleIdToPosition[fEle.id] = {
                  space,
                  idx1: eleGroup.length - 1,
                  idx2: 0
                }
              } else {
                // 有被对比
                haslog && console.log(19, "还有处理")
              }
            }
          }
        } else {
          haslog && console.log("什么也没有", ele.id)
          if (elePo) {
            // 有当前，不用做处理，观察一下
          } else {
            // 没有当前,直接push
            eleGroup.push([ele])
            eleIdToPosition[ele.id] = {
              idx1: eleGroup.length - 1,
              idx2: 0
            }
          }
        }
      }
    });

    (haslog || elements.length === 18) && console.log("eleGroup 结果: ", eleGroup.map((i) => i.map((i) => i.id)))
    haslog && console.log("eleIdToPosition 位置信息: ", eleIdToPosition)

    // return []

    let newElements = this.convertedToElements(eleGroup)

    // console.log("newElements: ", newElements)

    // // 临时测试
    // return newElements

    if (newElements.length === 1) {
      return newElements
    } else if (eleGroup.length === elements.length) {
      return this.splitElements(newElements)
    } else {
      return this.splitElements(newElements)
    }

    if (eleGroup.length === elements.length || newElements.length === 1) {
      console.log("newElements: ", newElements)
      return newElements
    } else {
      console.log("继续分析: ", newElements)
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