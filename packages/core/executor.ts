/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */
import {logInputVal, logOutputVal} from './logger';
import {uuid, dataSlim, easyClone, easyDeepCopy} from "./utils";
import { canNextHackForSameOutputsAndRelOutputs } from "./hack";

const ROOT_FRAME_KEY = '_rootFrame_'

/**
 * TODO:
 * 1. fromCon 是什么？能不能干掉
 */

export default function executor(opts, {observable}) {
  const {
    json,
    getComDef,
    env,
    ref,
    onError,
    logger,
    debug,
    debugLogger,
    _isNestedRender,
    _context,
  } = opts

  const scenesOperate = opts.scenesOperate || env.scenesOperate

  const {
    _v,
    id: jsonID,
    slot: UIRoot,
    coms = {},
    comsAutoRun: ComsAutoRun = {},
    cons: Cons = [],
    pinRels: PinRels = {},
    pinProxies: PinProxies = {},
    pinValueProxies: PinValueProxies = {},
    type: JsonType
  } = json
  let Coms = coms;
  if (_v === "2024-diff") {
    Coms = new Proxy(coms, {
      get(target, key) {
        const result = target[key];
        if (!result || result._ready) {
          return result
        }
        const { def } = result
        result._ready = true
        const comDef = getComDef(def)

        const model = result.model
        const modelData = model.data

        if (modelData) {
          model.data = Object.assign(easyDeepCopy(comDef.data), modelData)
        } else {
          model.data = easyDeepCopy(comDef.data)
        }

        if (!def.rtType?.match(/^js/gi)) {
          // 说明是UI组件，非计算组件，需要合并inputs、outputs
          result.inputs = comDef.inputs.concat(model.inputAry)
          result.outputs = comDef.outputs.concat(model.outputAry)
        }

        return result
      }
    })
  }

  const _Env = env

  const _Props: any = {}

  const _frameOutputProxy: any = {}

  const _exedJSCom = {}

  const _frameOutput: any = {}

  /** _next */
  const _nextConsPinKeyMap = {}

  Object.keys(Cons).forEach((key) => {
    const cons = Cons[key]
    const {startPinParentKey} = cons[0]

    if (startPinParentKey) {
      _nextConsPinKeyMap[startPinParentKey] = key
    }
  })

  // 多输入
  const _valueBarrier: any = {}

  // 等待的pin
  const _timerPinWait: any = {}

  // 当前输入项
  const _slotValue: any = {}
  
  const _variableRelationship: any = {}

  /** 全局保存变量值, 在每次变量输出时存储值，变量为内置组件，知道其内部实现 */
  const _var: any = {}

  /** 变量和作用域的关系 */
  const _varSlotMap = {}

  /** 组件ID-插槽ID 查询slotDef */
  const _slotDefMap = {}

  function _logOutputVal(type: 'com' | 'frame',
                         content:
                           {
                             com,
                             pinHostId,
                             val,
                             comDef,
                             fromCon?,
                             notifyAll?
                           }//com
                           |
                           {
                             comId,
                             frameId,
                             pinHostId,
                             val,
                             sceneId
                           },//frame
                           isBreakpoint
  ) {
    // if (_isNestedRender) {
    //   return
    // }
    if (type === 'com') {
      const {com, pinHostId, val, fromCon, notifyAll, comDef, conId} = content
      if (debugLogger) {//存在外部的debugLogger
        debugLogger('com', 'output', {id: com.id, pinHostId, val: dataSlim(val), fromCon, notifyAll, comDef, sceneId: json.id, conId}, isBreakpoint)
      } else {
        logOutputVal(com.title, comDef, pinHostId, val)
      }
    } else if (type === 'frame') {
      const {comId, frameId, pinHostId, val,sceneId, conId} = content
      if (debugLogger) {//存在外部的debugLogger
        debugLogger('frame', 'output', {comId, frameId, pinHostId, val: dataSlim(val),sceneId: sceneId || json.id, conId}, isBreakpoint)
      }
    }
  }

  function _logInputVal(content: {
    com,
    pinHostId,
    val,
    frameKey,
    finishPinParentKey,
    comDef
  }, isBreakpoint) {
    // if (_isNestedRender) {
    //   return
    // }
    const {com, pinHostId, val, frameKey, finishPinParentKey, comDef, conId} = content
    if (conId) {
      if (debugLogger) {//存在外部的debugLogger
        debugLogger('com', 'input', {id: com.id, pinHostId, val: dataSlim(val), frameKey, finishPinParentKey, comDef, sceneId: json.id, conId}, isBreakpoint)
      } else {
        logInputVal(com.title, comDef, pinHostId, val)
      }
    }
  }

  function exeCon(pInReg: any, nextScope: any, val: any, fromCon: any) {
    const proxyDesc = PinProxies[pInReg.comId + '-' + pInReg.pinId]
    let inReg = pInReg

    if (proxyDesc) {
      const isFrameOutput = inReg.def?.namespace === 'mybricks.core-comlib.frame-output'
      if (isFrameOutput) {
        inReg = {
          ...pInReg,
          type: proxyDesc.type,
          frameId: proxyDesc.frameId,
          pinId: proxyDesc.pinId,
          direction: 'inner-input',
          comId: (pInReg.targetFrameKey || pInReg.frameKey).split('-')[0]
        }
      } else {
        _slotValue[`${proxyDesc.frameId}-${proxyDesc.pinId}`] = val
        if (fromCon && fromCon.finishPinParentKey !== inReg.startPinParentKey) {
          return
        }
  
        if (proxyDesc.type === 'frame') {//call fx frame
  
          const comProps = getComProps(inReg.comId, nextScope)
          let myScope: any
          //if (!curScope) {
          myScope = {
            // id: nextScope?.id || uuid(10, 16),
            id: uuid(10, 16),
            frameId: proxyDesc.frameId,
            parent: nextScope,
            proxyComProps: comProps//current proxied component instance
          }
          //}
  
          // const isFrameOutput = inReg.def.namespace === 'mybricks.core-comlib.frame-output'
  
          // if (isFrameOutput && nextScope) {
          //   proxyDesc.frameId = nextScope.proxyComProps.id
          //   myScope = nextScope.parent
          // }
          const isFn = inReg.def.namespace === 'mybricks.core-comlib.fn'
  
          if (isFn) {
            const { configs } = comProps.data
            if (configs) {
              Object.entries(configs).forEach(([key, value]) => {
                const { frameId, comId, pinId } = proxyDesc
                const idPre = comId ? `${comId}-${frameId}` : `${frameId}`
                const cons = Cons[idPre + '-' + key]
                if (cons) {
                  exeCons({logProps: null, cons, val: value, curScope: myScope})
                }
              })
            }
          }
  
          exeInputForFrame({ options: proxyDesc, value: val, scope: myScope, comProps })
  
          if (!isFrameOutput) {
            exeForFrame({frameId: proxyDesc.frameId, scope: myScope})
          }
          return
        }
      }
    }

    if (inReg.type === 'com') {
      if (fromCon) {
        if (fromCon.finishPinParentKey === inReg.startPinParentKey) {//same scope,rels///TODO
          exeInputForCom(inReg, val, nextScope)
        }
      } else {
        exeInputForCom(inReg, val, nextScope)
      }
    } else if (inReg.type === 'frame') {//frame-inner-input -> com-output proxy,exg dialog
      if (fromCon) {
        if (fromCon.finishPinParentKey !== inReg.startPinParentKey) {//same scope,rels
          return
        }
      }

      if (inReg.comId && proxyDesc?.frameId !== jsonID) {
        if (inReg.direction === 'inner-input') {
          // const proxyFn = _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + (nextScope?.parent?.id ? (nextScope.parent.id + '-') : '') + inReg.pinId]
          // TODO

          // console.log('inReg: ', inReg)
          // console.log('nextScope: ', nextScope)
          // console.log('第一个: ', inReg.frameKey + '-' + inReg.pinId, _frameOutputProxy[inReg.frameKey + '-' + inReg.pinId])
          // console.log('第二个: ', inReg.comId + '-' + inReg.frameId + '-' + (nextScope?.parent?.id ? (nextScope.parent.id + '-') : '') + inReg.pinId, _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + (nextScope?.parent?.id ? (nextScope.parent.id + '-') : '') + inReg.pinId])
          const proxyFn = _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + (nextScope?.id ? (nextScope.id + '-') : '') + inReg.pinId] || _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + (nextScope?.parent?.id ? (nextScope.parent.id + '-') : '') + inReg.pinId] || _frameOutputProxy[inReg.frameKey + '-' + inReg.pinId]
          if (proxyFn) {
            proxyFn(val)
          }
        } else if (inReg.direction === 'inner-output' && inReg.pinType === 'joint') {//joint
          const cons = Cons[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
          if (cons) {
            exeCons({logProps: null, cons, val})
          }
        }
      } else {
        const proxiedComProps = nextScope?.proxyComProps
        if (proxiedComProps) {

          const outPin = proxiedComProps.outputs[inReg.pinId]
          if (outPin) {
            outPin(val, nextScope.parent)
            return
          }
        }

        _frameOutput[inReg.pinId]?.(val)
      }
    } else {
      throw new Error(`尚未实现`)
    }
  }

  function exeCons({logProps, cons, val, curScope, fromCon, notifyAll, fromCom, isAutoRun}: any) {
    if (!_isNestedRender && debug) {
      // 开启断点的连线先执行
      cons.sort((a: any, b: any) => {
        if (a.isBreakpoint && !b.isBreakpoint) {
          return -1
        } else if (!a.isBreakpoint && b.isBreakpoint) {
          return 1
        } else {
          return 0
        }
      })
    }

    cons.forEach(async (inReg: any) => {
      const { comId, pinId, pinType, timerPinInputId, frameKey } = inReg;
      const component = Coms[comId]

      if (fromCon) {
        if (fromCon.finishPinParentKey !== inReg.startPinParentKey) {//same scope,rels///TODO
          return
        }
      } else {
        // HACK: 
        if (!canNextHackForSameOutputsAndRelOutputs(fromCom, inReg, logProps)) {
          return
        }
      }

      if (!_isNestedRender && debug && inReg.isIgnored) {
        return
      }
      if (!_isNestedRender && debug && _context.debuggerPanel?.hasBreakpoint(inReg)) {
        let hasLog = true
        await _context.debuggerPanel?.wait(inReg, () => {
          hasLog = false
          if (logProps) {
            logProps[1].conId = inReg.id
            logProps && _logOutputVal(...logProps, true)
          }
        })
        if (hasLog && logProps) {
          logProps[1].conId = inReg.id
          logProps && _logOutputVal(...logProps)
        }
      } else {
        logProps && _logOutputVal(...logProps)
      }

      // 这里需要等待多输入和timer
      if (pinType === "timer") {
        // 这里不存在多输入，直接执行即可
        next({value: val, curScope, inReg, notifyAll, fromCon})
      } else {
        if (notifyAll) {
          const frameKey = inReg.frameKey
          if (frameKey === ROOT_FRAME_KEY || isAutoRun) { // 插槽内对变量的监听在插槽第一次渲染时默认触发一次
            callNext({ pinId, value: val, component, curScope: null, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
          } else {
            const [comId, slotId] = frameKey.split('-')

            if (!_variableRelationship[frameKey]) {
              const frameToComIdMap: any = _variableRelationship[frameKey] = {}
              frameToComIdMap[fromCom.id] = {
                [inReg.id]: inReg,
              }
            } else {
              const frameToComIdMap: any = _variableRelationship[frameKey]
              const consMap = frameToComIdMap[fromCom.id]
              if (!consMap) {
                frameToComIdMap[fromCom.id] = {
                  [inReg.id]: inReg,
                }
              } else {
                consMap[inReg.id] = inReg
              }
            }

            if (fromCom.parentComId) {
              /** 监听到作用域内变量更新，仅监听当前作用域 */
              callNext({ pinId, value: val, component, curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
            } else {
              /** 监听到非作用域变量，更新所有作用域 */
              const frameProps = _Props[`${comId}-${slotId}`]
              if (frameProps) {
                // Object.entries(frameProps).forEach(([key, slot]: any) => {
                //   if (slot?.type === 'scope') {
                //     // 作用域插槽
                //     if (!slot.curScope) {
                //       // 还没完成渲染
                //       slot.pushTodo((curScope: any) => {
                //         callNext({ pinId, value: val, component, curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
                //       })
                //     } else {
                //       callNext({ pinId, value: val, component, curScope: slot.curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
                //     }
                //   } else {
                //     callNext({ pinId, value: val, component, curScope: slot.curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
                //   }
                // })
                const entries = Object.entries(frameProps)
                const length = entries.length
                entries.forEach(([key, slot]: any) => {
                  if (length > 1 && key === 'slot') {

                  } else {
                    if (slot?.type === 'scope') {
                      // 作用域插槽
                      if (!slot.curScope) {
                        // 还没完成渲染
                        slot.pushTodo((curScope: any) => {
                          callNext({ pinId, value: val, component, curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
                        })
                      } else {
                        callNext({ pinId, value: val, component, curScope: slot.curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
                      }
                    } else {
                      callNext({ pinId, value: val, component, curScope: slot.curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
                    }
                  }
                })
              }
            } 
          }
        } else {
          callNext({ pinId, value: val, component, curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon})
        }
      }
    })
  }

  // 这里需要劫持所有东西，所以说多输入这里也需要劫持
  function next({ pinId, value, curScope, inReg, notifyAll, fromCon }: any) {
    let nextScope = curScope
    const finalInReg = pinId ? {...inReg, pinId} : inReg

    if (notifyAll) {
      const frameKey = finalInReg.frameKey
      if (!frameKey) {
        throw new Error(`数据异常，请检查toJSON结果.`)
      }
      if (frameKey === ROOT_FRAME_KEY) {//root作用域
        exeCon(finalInReg, {}, value, fromCon)
      } else {
        // const ary = frameKey.split('-')
        // if (ary.length >= 2) {
        //   const slotProps = getSlotProps(ary[0], ary[1], nextScope, notifyAll)
        //   if (!slotProps.curScope) {
        //     slotProps.pushTodo((curScope) => {
        //       exeCon(finalInReg, curScope, value)
        //     })
        //   } else {
        //     exeCon(finalInReg, slotProps.curScope, value)
        //   }
        // }
        exeCon(finalInReg, curScope, value, fromCon)
      }
    } else {
      const ary = finalInReg.frameKey.split('-')
      if (ary.length >= 2 && !nextScope) {
        // 如果是作用域内却没有scope信息
        const slotProps = getSlotProps(ary[0], ary[1], null, false)

        if (slotProps?.type === 'scope') {
          // 作用域插槽
          if (!slotProps.curScope) {
            // 还没完成渲染
            slotProps.pushTodo((curScope: any) => {
              exeCon(finalInReg, curScope, value, fromCon)
            })
          } else {
            exeCon(finalInReg, slotProps.curScope, value, fromCon)
          }
        } else {
          exeCon(finalInReg, nextScope, value, fromCon)
        }
      } else {
        exeCon(finalInReg, nextScope, value, fromCon)
      }
    }
  }

  function callNext({ pinId, value, component, curScope, comId, val, timerPinInputId, frameKey, inReg, notifyAll, fromCon }: any) {
    const { isReady, isMultipleInput, pinId: realPinId, value: realValue, cb } = transformInputId({ pinId, value, component, curScope, comId, val })

    if (isReady) {
      const nextProps = {
        pinId: isMultipleInput ? realPinId : null,
        value: realValue,
        curScope,
        inReg, notifyAll, fromCon
      }
      // 可以触发
      if (timerPinInputId) {
        // debugger
        // const timerKey = curScope ? timerPinInputId + '-' + curScope.id : timerPinInputId
        const timerKey = timerPinInputId + '-' + frameKey + (curScope?.id ? `-${curScope.id}` : '')
        const timerWaitInfo = _timerPinWait[timerKey]
        if (timerWaitInfo) {
          const { ready, todo } = timerWaitInfo
          if (ready) {
            let hasSameFn = false
            Object.entries(todo).forEach(([key, todoFn]: any) => {
              if (key === realPinId) {
                next(nextProps)
                hasSameFn = true
              } else {
                todoFn()
              }
            })
            if (!hasSameFn) {
              next(nextProps)
            }
            cb?.()
            Reflect.deleteProperty(_timerPinWait, timerKey)
          } else {
            todo[realPinId] = () => {
              cb?.()
              next(nextProps)
            }
          }
        } else {
          _timerPinWait[timerKey] = {
            ready: false,
            todo: {
              [realPinId]: () => {
                cb?.()
                next(nextProps)
              }
            }
          }
        }
      } else {
        cb?.()
        next(nextProps)
      }
    }
  }

  function transformInputId({ pinId, value, component, curScope, comId, val }: any) {
    const pidx = pinId.indexOf('.')
    const result = {
      pinId,
      value,
      isReady: true,
      isMultipleInput: false,
      cb: null
    }
    if (component && pidx !== -1) {
      const valueBarrierKey = component.id + `${curScope?.id ? `-${curScope.id}` : ''}`
      // 多输入
      const { inputs } = component
      const finalPinId = pinId.substring(0, pidx)
      result.pinId = finalPinId
      const paramId = pinId.substring(pidx + 1)
      let barrier = _valueBarrier[valueBarrierKey]
      if (!barrier) {
        barrier = _valueBarrier[valueBarrierKey] = {}
      }
      barrier[paramId] = val
      const regExp = new RegExp(`${finalPinId}.`)
      const allPins: string[] = inputs.filter((pin: string) => {
        return !!pin.match(regExp)
      })

      if (Object.keys(barrier).length === allPins.length) {
        // 多输入全部到达
        result.value = barrier
        result.isMultipleInput = true
        result.cb = () => {
          Reflect.deleteProperty(_valueBarrier, valueBarrierKey)
        }
      } else {
        result.isReady = false
      }
    }

    return result
  }

  function getComProps(comId,
                       scope?: {
                         id: string,
                         frameId: string,
                         parent
                       },
                       //ioProxy?: { inputs, outputs, _inputs, _outputs }
  ) {
    const com = Coms[comId]
    if (!com) return null
    const comInFrameId = comId + (com.frameId || ROOT_FRAME_KEY)

    let frameProps = _Props[comInFrameId]
    if (!frameProps) {
      frameProps = _Props[comInFrameId] = {}
    }

    let storeScopeId
    let curScope = scope

    if (!curScope && com.parentComId && com.frameId) {
      // curScope = _Props[`${com.parentComId}-${com.frameId}`]?.curScope
      curScope = _Props[`${com.parentComId}-${com.frameId}`]?.slot?.curScope
    }

    while (curScope) {
      const key = curScope.id + '-' + comId

      if (curScope.frameId === com.frameId) {
        storeScopeId = curScope.id

        const found = frameProps[key]
        if (found) {
          return found
        } else {
          const parentComId = curScope.parentComId
          if (parentComId) {
            if ((parentComId === com.paramId) || (parentComId === com.parentComId)) {
              break
            }
          } else {
            break
          }
        }
      }

      curScope = curScope.parent
    }

    const key = (storeScopeId ? (storeScopeId + '-') : '') + comId

    const found = frameProps[key]//global
    if (found) {
      return found
    }

    const def = com.def
    const model = com.model

    // let nModel = opts ? JSON.parse(JSON.stringify(model)) : model
    // const obsModel = observable(nModel)

    const modelData = JSON.parse(JSON.stringify(model.data))
    const modelStyle = JSON.parse(JSON.stringify(model.style))
    modelStyle.__model_style__ = true

    const inputRegs = {}
    const inputTodo = {}

    const _inputRegs = {}
    const _inputTodo = {}

    const addInputTodo = (inputId, val, fromCon, fromScope) => {
      let ary = inputTodo[inputId]
      if (!ary) {
        inputTodo[inputId] = ary = []
      }
      ary.push({val, fromCon, fromScope})
    }

    const inputs = function (ioProxy?: {
      inputs,
      outputs
    }) {
      return new Proxy({}, {
        ownKeys(target) {
          return com.inputs
        },
        getOwnPropertyDescriptor(k) {
          return {
            enumerable: true,
            configurable: true,
          }
        },
        get(target, name) {
          return function (fn) {
            if (Object.prototype.toString.call(name) === '[object Symbol]') {
              return
            }
            const proxiedInputs = ioProxy?.inputs
            if (proxiedInputs) {//存在代理的情况
              const proxy = proxiedInputs[name]
              if (typeof proxy === 'function') {
                proxy(fn)
              }
            }
            inputRegs[name] = fn
            const ary = inputTodo[name]
            if (ary) {
              ary.forEach(({val, fromCon, fromScope}) => {
                fn(val, new Proxy({}, {//relOutputs
                  get(target, name) {
                    return function (val) {
                      if (Object.prototype.toString.call(name) === '[object Symbol]') {
                        return
                      }
                      const fn = outputs()[name]
                      if (typeof fn === 'function') {
                        fn(val, fromScope || curScope, fromCon)
                      } else {
                        throw new Error(`outputs.${name} not found`)
                      }
                    }
                  }
                }))
              })
              inputTodo[name] = void 0
            }
            //}
          }
        }
      })
    }

    const inputsCallable = new Proxy({}, {
      get(target, name) {
        return function (val) {
          if (Object.prototype.toString.call(name) === '[object Symbol]') {
            return
          }
          const rels = PinRels[comId + '-' + name]
          if (rels) {
            const rtn = {}
            const reg = {}

            rels.forEach(relId => {
              rtn[relId] = proFn => {
                reg[relId] = proFn
              }
            })

            Promise.resolve().then(() => {
              const inReg = {comId, def, pinId: name}
              exeInputForCom(inReg, val, scope, reg)
            })

            return rtn
          } else {
            const inReg = {comId, def, pinId: name}
            exeInputForCom(inReg, val, scope)
          }
        }
      }
    })

    const _inputsCallable = new Proxy({}, {
      get(target, name) {
        return function (val) {
          if (Object.prototype.toString.call(name) === '[object Symbol]') {
            return
          }
          const proxyDesc = PinProxies[comId + '-' + name]

          if (proxyDesc) {
            scenesOperate?.inputs({
              ...proxyDesc,
              value: val,
              parentScope: rtn
            })
          }
        }
      }
    })

    const outputs = function (ioProxy?: {
      inputs,
      outputs
    }) {
      return new Proxy({}, {
        ownKeys(target) {
          return com.outputs
        },
        getOwnPropertyDescriptor(k) {
          return {
            enumerable: true,
            configurable: true,
          }
        },
        get(target, name, receiver) {
          const exe = function (val, _myScope, fromCon, isCurrent) { // isCurrent 当前全局变量
            if (Object.prototype.toString.call(name) === '[object Symbol]') {
              return
            }
            const notifyAll = typeof _myScope === 'boolean' && _myScope//变量组件的特殊处理

            if (notifyAll) {
              if (com.parentComId) {
                const key = `${com.parentComId}-${com.frameId}`
                if (!_varSlotMap[key]) {
                  _varSlotMap[key] = {[comId]: true}
                } else {
                  _varSlotMap[key][comId] = true
                }
              }
              _var[`${com.id}${scope?.id ? `-${scope.id}` : ''}`] = val

              if (com.global && !isCurrent) {
                scenesOperate?.exeGlobalCom({
                  com,
                  value: val,
                  pinId: name
                })
                return
              }
            }

            const args = arguments
            const proxiedOutputs = ioProxy?.outputs
            if (proxiedOutputs) {//存在代理的情况
              const proxy = proxiedOutputs[name]
              if (typeof proxy === 'function') {
                proxy(val)
              }
            }

            let myScope
            if (_myScope && typeof _myScope === 'object') {//存在组件中output数据有误的情况
              myScope = _myScope
            }

            const comDef = getComDef(def)
            if (!comDef) return

            const evts = model.outputEvents
            let cons
            if (evts) {
              const eAry = evts[name]
              if (eAry && Array.isArray(eAry)) {
                const activeEvt = eAry.find(e => e.active)
                if (activeEvt) {
                  const {type} = activeEvt
                  switch (type) {
                    case 'none':
                      cons = []
                      break
                    case 'fx':
                      const proxyDesc = PinProxies[comId + '-' + name]
                      if (proxyDesc?.type === 'frame') {
                        const key = `${proxyDesc.frameId}-${proxyDesc.pinId}`
                        cons = Cons[key] || []
                        _slotValue[key] = val
                      } else {
                        cons = []
                      }
                      break
                    case 'defined':
                      break
                    default:
                      cons = []
                      if (Array.isArray(env?.events)) {
                        const def = env.events.find(ce => {
                          if (ce.type === type) {
                            return ce
                          }
                        })
                        if (def && typeof def.exe === 'function') {
                          def.exe({options: activeEvt.options})//与设计器中的使用方法对齐
                        }
                      }
                      break
                  }
                }
              }
            }

            cons = cons || Cons[comId + '-' + name]
            if (cons?.length) {
              if (args.length >= 3 && typeof isCurrent === 'undefined') {//明确参数的个数，属于 ->in(com)->out
                exeCons({logProps: ['com', {com, pinHostId: name, val, fromCon, notifyAll, comDef}], cons, val, curScope: myScope, fromCon, fromCom: com})
              } else {//组件直接调用output（例如JS计算），严格来讲需要通过rels实现，为方便开发者，此处做兼容处理
                //myScope为空而scope不为空的情况，例如在某作用域插槽中的JS计算组件
                exeCons({logProps: ['com', {com, pinHostId: name, val, fromCon, notifyAll, comDef}], cons, val, curScope: myScope || scope, fromCon, notifyAll, fromCom: com})
              }
            } else {
              _logOutputVal('com', {com, pinHostId: name, val, fromCon, notifyAll, comDef})
            }
          }

          exe.getConnections = () => {
            return Cons[comId + '-' + name] || []
          }

          return exe
        }
      })
    }

    const _inputs = new Proxy({}, {
      get(target, name, receiver) {
        return function (fn) {
          if (Object.prototype.toString.call(name) === '[object Symbol]') {
            return
          }
          _inputRegs[name] = fn
          const ary = _inputTodo[name]
          if (ary) {
            ary.forEach(val => {
              fn(val)
            })
            _inputTodo[name] = void 0
          }
        }
      }
    })

    const _outputs = new Proxy({}, {
      get(target, name, receiver) {
        return function (val) {
          if (Object.prototype.toString.call(name) === '[object Symbol]') {
            return
          }
          const cons = Cons[comId + '-' + name]
          if (cons) {
            exeCons({logProps: ['com', {com, pinHostId: name, val, comDef: def}], cons, val, curScope: scope})
          } else {
            _logOutputVal('com', {com, pinHostId: name, val, comDef: def})
          }
        }
      }
    })

    function _notifyBindings(val) {
      if (com.global) {
        scenesOperate?._notifyBindings(val, com)
        return
      }
      const {bindingsTo} = com.model
      if (bindingsTo) {
        for (let comId in bindingsTo) {
          const com = getComProps(comId)
          if (com) {
            const bindings = bindingsTo[comId]
            if (Array.isArray(bindings)) {
              bindings.forEach((binding) => {
                let nowObj = com
                const ary = binding.split(".")
                ary.forEach((nkey, idx) => {
                  if (idx !== ary.length - 1) {
                    nowObj = nowObj[nkey];
                  } else {
                    nowObj[nkey] = val;
                  }
                })
              })
            }
          }
        }
      }
    }

    const isJS = def.rtType?.match(/^js/gi)

    const rtn = {
      id: com.id,
      title: com.title,
      frameId: com.frameId,
      parentComId: com.parentComId,
      data: isJS ? modelData : observable(modelData),
      style: isJS ? modelStyle : observable(modelStyle),
      _inputRegs: inputRegs,
      addInputTodo,
      inputs: inputs(),
      inputsCallable,
      _inputsCallable,
      outputs: outputs(),
      _inputs,
      _outputs,
      clone(ioProxy) {
        const rtn = {
          inputs: inputs(ioProxy),
          outputs: outputs(ioProxy),
        }

        Object.setPrototypeOf(rtn, this)

        return rtn
      },
      _notifyBindings,
      logger,
      onError: (
        // !_isNestedRender && 
        debug) ? (error) => onError({comId, error, title: com.title}) : onError
    }

    frameProps[key] = rtn

    return rtn
  }

  function getSlotValue(key, scope) {
    let val = _slotValue[`${key}${scope ? `-${scope.id}-${scope.frameId}` : ''}`]
    if ((typeof val === 'undefined') && scope?.parent) {
      val = getSlotValue(key, scope.parent)
    }

    return easyClone(val)
  }

  function exeInputForCom(inReg, val, scope, outputRels?) {
    const {comId, def, pinId, pinType, frameKey, finishPinParentKey, timerPinInputId, targetFrameKey} = inReg

    if (pinType === 'ext') {
      const props = _Props[comId] || getComProps(comId, scope)
      const sty = props.style
      let display = sty.display
      let visibility = sty.visibility

      if (pinId === 'show') {
        display = ''
        visibility = 'visible'
      } else if (pinId === 'hide') {
        display = 'none'
        visibility = 'hidden'
      } else if (pinId === 'showOrHide') {
        if (typeof val === 'undefined') {
          if (display === 'none') {
            display = ''
            visibility = 'visible'
          } else {
            display = 'none'
            visibility = 'hidden'
          }
        } else {
          display = val ? '' : 'none'
          visibility = val ? 'visible' : 'hidden'
        }
      }

      if (!sty.inSmartLayout) {
        // 不在智能布局下，设置display，智能布局下默认占位
        // sty.display = display
      }
      sty.display = display
      // sty.visibility = visibility

      const comDef = getComDef(def)
      if (!comDef) return
      _logInputVal({com: props, val, pinHostId: pinId, frameKey, finishPinParentKey, comDef, conId: inReg.id})
    } else if (pinType === 'config') {
      const props = getComProps(comId, scope);
      const comDef = getComDef(def);
      if (!comDef) return
      //logInputVal(props.title, comDef, pinId, val);
      _logInputVal({com: props, pinHostId: pinId, val, frameKey, finishPinParentKey, comDef, conId: inReg.id})

      /**
       * 配置项类型，根据extBinding值操作
       * 例如：extBinding：data.text
       * 结果：props.data.text = val
       */
      const {extBinding} = inReg;
      const ary = extBinding.split(".");
      let nowObj = props;

      ary.forEach((nkey, idx) => {
        if (idx !== ary.length - 1) {
          nowObj = nowObj[nkey];
        } else {
          nowObj[nkey] = val;
        }
      })
    } else if (pinType === 'timer') {
      const props = getComProps(comId, scope);
      const comDef = getComDef(def);
      if (!comDef) return
      _logInputVal({com: props, pinHostId: pinId, val, frameKey, finishPinParentKey, comDef, conId: inReg.id})
      const timerKey = timerPinInputId + '-' + frameKey + (scope?.id ? `-${scope.id}` : '')
      const timerWaitInfo = _timerPinWait[timerKey]
      if (timerWaitInfo) {
        const { todo } = timerWaitInfo
        Object.entries(todo).forEach(([_, fn]: any) => fn())
        Reflect.deleteProperty(_timerPinWait, timerKey)
      } else {
        _timerPinWait[timerKey] = {
          ready: true,
          todo: {}
        }
      }
    } else {
      if (def.rtType?.match(/^js/gi)) {//js
        const jsCom = Coms[comId]
        if (jsCom) {
          const props = getComProps(comId, scope)
          const comDef = getComDef(def)
          if (!comDef) return
          if (jsCom.global) {
            const globalProps = scenesOperate?.getGlobalComProps(comId)
            if (globalProps) {
              props.data = globalProps.data
            }
          }
          const scopeId = scope?.id
          // const myId = (scope ? scope.id + '-' : '') + comId
          const myId = (scopeId ? scopeId + '-' : '') + comId
          //logInputVal(props.title, comDef, pinId, val)

          if (jsCom.inputs.find((inputId) => inputId === pinId)) {
            _logInputVal({com: jsCom, val, pinHostId: pinId, frameKey, finishPinParentKey, comDef, conId: inReg.id})
          } else {
            Object.entries(val).forEach(([key, value]) => {
              _logInputVal({com: jsCom, val: value, pinHostId: `${pinId}.${key}`, frameKey, finishPinParentKey, comDef, conId: inReg.id})
            })
          }

          if (!_exedJSCom[myId]) {
            _exedJSCom[myId] = true

            comDef.runtime({//exe once
              env: _Env,
              data: props.data,
              inputs: props.inputs,
              outputs: props.outputs,
              _notifyBindings: props._notifyBindings,
              _inputsCallable: props._inputsCallable,
              logger,
              onError: (
                // !_isNestedRender && 
                debug) ? (error) => onError({comId, error, title: jsCom.title}) : onError
            })
          }

          const fn = props._inputRegs[pinId]
          if (typeof fn === 'function') {
            fn(val, new Proxy({}, {//relOutputs
              get(target, name) {
                return function (val: any) {
                  if (Object.prototype.toString.call(name) === '[object Symbol]') {
                    return
                  }
                  if (PinValueProxies) {
                    const pinValueProxy = PinValueProxies[`${comId}-${pinId}`]
                    if (pinValueProxy) {
                      const frameId = pinValueProxy.frameId
                      const slotValueKey = `${frameId === json.id ? ROOT_FRAME_KEY : (targetFrameKey || frameKey)}-${pinValueProxy.pinId}`
                      val = getSlotValue(slotValueKey, scope)
                      if (typeof val === 'undefined') {
                        val = getSlotValue(slotValueKey, null)
                      }
                    }
                  }
                  props.outputs[name](val, scope, inReg)
                }
              }
            }))
          } else {
            props.addInputTodo(pinId, val, inReg, scope)
          }
        }
      } else {//ui
        const props = getComProps(comId, scope)
        if (!props) {
          return
        }
        const comDef = getComDef(def)
        if (!comDef) return
        _logInputVal({com: props, pinHostId: pinId, val, frameKey, finishPinParentKey, comDef, conId: inReg.id})


        const fn = props._inputRegs[pinId]
        if (typeof fn === 'function') {
          let nowRels
          if (outputRels) {
            nowRels = outputRels
          } else {
            nowRels = new Proxy({}, {//relOutputs
              get(target, name) {
                return function (val) {
                  if (Object.prototype.toString.call(name) === '[object Symbol]') {
                    return
                  }
                  props.outputs[name](val, scope, inReg)//with current scope
                }
              }
            })
          }

          fn(val, nowRels)
        } else {
          props.addInputTodo(pinId, val, inReg, scope)
        }
      }
    }

    if (finishPinParentKey) {
      const cons = Cons[_nextConsPinKeyMap[finishPinParentKey]]
      if (cons && !PinRels[`${comId}-${pinId}`]) {
        exeCons({logProps: null, cons, val: void 0})
      }
    }
  }

  function searchComInSlot(slot, comId) {
    let result
    console.log()
    if (slot?.comAry) {
      slot.comAry.find(com => {
        if (com.id === comId) {
          result = com
          return com
        }
        if (com.slots) {
          for (let id in com.slots) {
            result = searchComInSlot(com.slots[id], comId)
            if (result) {
              return result
            }
          }
        }
      })
    }

    return result
  }

  function getSlotProps(comId, slot, scope, notifyAll?) {
    const hasSlotDef = typeof slot === "string" ? false : true;
    const slotId =  hasSlotDef ? slot.id : slot;
    const slotKey = `${comId}-${slotId}`
    let frameProps = _Props[slotKey]
    if (!frameProps) {
      frameProps = _Props[slotKey] = {}
    }

    // let key = comId + '-' + slotId + (scope ? `-${scope.id}` : '')

    let key = scope ? scope.id : "slot"

    // let rtn = _Props[key]

    // if (notifyAll && !rtn) {
    //   rtn = _Props[Object.keys(_Props).find((propsKey) => propsKey.startsWith(key)) as string]
    // }

    let rtn = frameProps[key]

    if (notifyAll && !rtn) {
      console.log("不应该再走到这儿了: ", { comId, slotId, scope, notifyAll })
      // rtn = _Props[Object.keys(_Props).find((propsKey) => propsKey.startsWith(key)) as string]
    }

    if (!rtn) {
      let slotDef = hasSlotDef ? slot : _slotDefMap[`${comId}-${slotId}`];

      if (!slotDef) {
        const foundCom = searchComInSlot(UIRoot, comId)
        if (!foundCom?.slots) {
          return null
        }
        slotDef = foundCom?.slots[slotId]
      }

      //const _outputRegs = {}
      const _inputRegs = {}

      let todo = void 0

      if (scope) {
        const errorPorps = _Props[comId + '-' + slotId]
        if (errorPorps) {
          todo = errorPorps.todo
        }
      }

      const Cur = {scope, todo}//保存当前scope，在renderSlot中调用run方法会被更新

      const _inputs = new Proxy({}, {
        get(target, name) {
          return function (fn) {
            if (Object.prototype.toString.call(name) === '[object Symbol]') {
              return
            }
            _inputRegs[name] = fn
          }
        }
      })

      const inputs = new Proxy({}, {
        get(target, name) {
          const exe = function (val, curScope) {//set data
            if (Object.prototype.toString.call(name) === '[object Symbol]') {
              return
            }
            // Slotrender调用inputs时会带上第二个参数curScope，可能存在组件内调用的情况，没有第二参数时使用Cur.scope
            let scope = curScope || Cur.scope
            const key = comId + '-' + slotId + '-' + name
            const cons = Cons[key]
            _slotValue[`${key}${scope ? `-${scope.id}-${scope.frameId}` : ''}`] = val

            if (cons) {
              exeCons({logProps: ['frame', {comId, frameId: slotId, pinHostId: name, val}], cons, val, curScope: scope})
            } else {
              _logOutputVal('frame', {comId, frameId: slotId, pinHostId: name, val})
            }
          }

          exe.getConnections = () => {
            return Cons[comId + '-' + slotId + '-' + name] || []
          }

          return exe
        }
      })

      const outputs = new Proxy({}, {
        get(target, name, receiver) {
          return function (fn) {//proxy for com's outputs
            if (Object.prototype.toString.call(name) === '[object Symbol]') {
              return
            }
            // TODO: 这里还需要多关注一下
            // console.log("注册_frameOutputProxy: ", {comId, slotId, scope})
            _frameOutputProxy[`${comId}-${slotId}-${scope?.id}-${name}`] = fn
            _frameOutputProxy[`${comId}-${slotId}-${scope?.parent?.id}-${name}`] = fn
            _frameOutputProxy[key + '-' + name] = fn
            _frameOutputProxy[slotKey + '-' + name] = fn
            // console.log("_frameOutputProxy fn 1: ", key + '-' + name)
            // console.log("_frameOutputProxy fn 2: ", slotKey + '-' + name)
            // console.log("_frameOutputProxy fn 3: ", `${comId}-${slotId}-${scope.parent.id}-${name}`)
            // console.log("_frameOutputProxy all: ", _frameOutputProxy)
            //_outputRegs[name] = fn
          }
        }
      })

      let runExed = {}

      rtn = frameProps[key] = {
        type: slotDef?.type,
        run(newScope) {
          let scope = Cur.scope
          if (newScope && scope !== newScope) {
            Cur.scope = newScope
            scope = newScope
          }
          // Cur.scope = scope//更新当前scope

          // for(let cid in Cons){
          //   const cons = Cons[cid]
          //   if(cons){
          //     cons.forEach(con=>{
          //       //con._exeScope = void 0
          //       if(con.frameKey===key){
          //         //debugger
          //         con._exeScope = scope//更新当前运行时scope
          //       }
          //     })
          //   }
          // }

          const scopeId = scope?.id || 'none'

          if (!runExed[scopeId]) {
            runExed[scopeId] = true//only once
            exeForFrame({comId, frameId: slotId, scope})
          }

          if (Array.isArray(Cur.todo)) {
            Cur.todo.forEach(fn => {
              Promise.resolve().then(() => {
                fn(scope)
              })
            })
            Cur.todo = void 0//执行完成清空
          }

          if (scope && key !== 'slot') {
            const frameKey = `${comId}-${slotId}`;
            const frameToComIdMap = _variableRelationship[frameKey]
            Promise.resolve().then(() => {
              if (frameToComIdMap) {
                Object.entries(frameToComIdMap).forEach(([comId, consMap]) => {
                  const fromCom = Coms[comId]
                  if (!fromCom.parentComId) {
                    const cons = Object.entries(consMap).map(([key, con]) => {
                      return con
                    })
                    if (cons.length) {
                      // isAutoRun 标识这是默认触发当前作用域内的变量
                      exeCons({logProps: null, cons, val: _var[comId], curScope: scope, notifyAll: true, fromCom: Coms[comId], isAutoRun: true})
                    }
                  }
                })
              }
            })
          }
        },
        destroy() {
          if (scope) {
            const frameKey = `${scope.parentComId}-${scope.frameId}`
            const slotMap = _varSlotMap[frameKey]
            if (slotMap) {
              Object.keys(slotMap).forEach((key) => {
                Reflect.deleteProperty(_var, `${key}-${scope.id}`)
              })
            }
          }

          // Reflect.deleteProperty(_Props, key)
          Reflect.deleteProperty(frameProps, key)
        },
        //_outputRegs,
        _inputs,
        _inputRegs,
        inputs,
        outputs,
        get curScope() {
          return Cur.scope
        },
        setCurScope(scope) {
          Cur.scope = scope
        },
        get todo() {
          return Cur.todo
        },
        pushTodo(fn) {
          if (!Cur.todo) {
            Cur.todo = []
          }
          Cur.todo.push(fn)
        },
        setSlotValue(slotValues, curScope) {
          const scope = curScope || Cur.scope
          Object.entries(slotValues).forEach(([name, value]) => {
            const key = comId + '-' + slotId + '-' + name
            _slotValue[`${key}${scope ? `-${scope.id}-${scope.frameId}` : ''}`] = value
          })
        }
      }
    }

    return rtn
  }

  function exeForFrame(opts) {
    const {comId, frameId, scope} = opts
    const idPre = comId ? `${comId}-${frameId}` : `${frameId}`

    const autoAry = ComsAutoRun[idPre]
    if (autoAry) {
      // 自执行组件（不需要输入项触发
      autoAry.forEach(com => {
        const {id, def} = com
        const jsCom = Coms[id]
        if (jsCom) {
          const props = getComProps(id, scope)
          const comDef = getComDef(def)
          if (!comDef) return

          comDef.runtime({
            env: _Env,
            data: props.data,
            inputs: props.inputs,
            outputs: props.outputs,
            _inputsCallable: props._inputsCallable,
            logger,
            onError: (
              // !_isNestedRender && 
              debug) ? (error) => onError({comId: id, error, title: jsCom.title}) : onError
          })
        }
      })
    }
  }

  function exeInputForFrame({ options, value, scope = void 0, log = true, comProps }) {
    const {frameId, comId, pinId,sceneId} = options
    const idPre = comId ? `${comId}-${frameId}` : `${frameId}`
    const cons = Cons[idPre + '-' + pinId]
    _slotValue[`${frameId}-${pinId}`] = value

    if (cons) {
      exeCons({logProps: ['frame', {comId, frameId, pinHostId: pinId, val: value,sceneId}], cons, val: value, curScope: scope})
    } else {
      if (log) {
        _logOutputVal('frame', {comId, frameId, pinHostId: pinId, val: value,sceneId})
      }
      if (frameId !== ROOT_FRAME_KEY) {
        if (json.id === frameId) {
          _frameOutput[pinId](value)
        } else {
          scenesOperate?.open({
            frameId,
            todo: {
              pinId,
              value: value
            },
            comProps,
            parentScope: scope.proxyComProps
          })
        }
      }
    }
  }

  const rst = {
    get({comId, slotId, slot, scope, _ioProxy}) {
      let ioProxy
      if (_ioProxy && (_ioProxy.inputs || _ioProxy.outputs || _ioProxy._inputs || _ioProxy._outputs)) {
        ioProxy = _ioProxy
      }

      if (slotId) {
        if (slot) {
          _slotDefMap[`${comId}-${slotId}`] = slot;
        }
        return getSlotProps(comId, slot || slotId, scope)
      } else {
        const rtn = getComProps(comId, scope)
        if (ioProxy) {
          return rtn.clone(ioProxy)
        } else {
          return rtn
        }
      }
    },
    getComInfo(id) {
      return Coms[id]
    }
  }

  if (typeof ref === 'function') {
    const refs = {
      style: UIRoot?.style,
      run() {
        exeForFrame({frameId: ROOT_FRAME_KEY})
      },
      inputs: new Proxy({}, {
        get(target, pinId) {
          return function (val,sceneId = void 0, log = true) {
            if (Object.prototype.toString.call(pinId) === '[object Symbol]') {
              return
            }
            exeInputForFrame({ options: {frameId: ROOT_FRAME_KEY, pinId,sceneId }, value: val, scope: void 0, log })
          }
        }
      }),
      outputs(id, fn) {
        _frameOutput[id] = fn;
      },
      get: rst.get,
      getComInfo: rst.getComInfo
    }
    // if (_context && JsonType === 'module') {
    //   _context.setRefs(json.id, refs)
    // }
    ref(refs)
  }

  return rst
}