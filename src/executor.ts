/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */
import {log, logInputVal, logOutputVal} from './logger';
import {uuid} from "./utils";

const ROOT_FRAME_KEY = '_rootFrame_'

export default function init(opts, {observable}) {
  const {
    json,
    comInstance,
    getComDef,
    env,
    ref,
    onError,
    logger
  } = opts

  const {
    slot: UIRoot,
    coms: Coms,
    comsAutoRun: ComsAutoRun,
    cons: Cons,
    pinRels: PinRels,
    pinProxies: PinProxies,
    pinValueProxies: PinValueProxies
  } = json

  const _Env = env

  const _Props = {}

  const _frameOutputProxy = {}

  const _exedJSCom = {}

  const _frameOutput = {}

  /** _next */
  const _nextConsPinKeyMap = {}

  Object.keys(Cons).forEach((key) => {
    const cons = Cons[key]
    const { startPinParentKey } = cons[0]

    if (startPinParentKey) {
      _nextConsPinKeyMap[startPinParentKey] = key
    }
  })

  const _valueBarrier = {}

  const _slotValue = {}

  function exeCons(cons, val, curScope, fromCon?, notifyAll?) {
    function exeCon(inReg, nextScope) {
      const proxyDesc = PinProxies[inReg.comId + '-' + inReg.pinId]
      if (proxyDesc) {
        _slotValue[`${proxyDesc.frameId}-${proxyDesc.pinId}`] = val
        if (fromCon&&fromCon.finishPinParentKey !== inReg.startPinParentKey) {
          return
        }

        if (proxyDesc.type === 'frame') {//call fx frame

          const comProps = getComProps(inReg.comId, nextScope)
          let myScope
          //if (!curScope) {
          myScope = {
            id: uuid(),
            frameId: proxyDesc.frameId,
            parent: nextScope,
            proxyComProps: comProps//current proxied component instance
          }
          //}

          exeInputForFrame(proxyDesc, val, myScope)
          return
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

        if (inReg.comId) {
          if (inReg.direction === 'inner-input') {
            const proxyFn = _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
            if (proxyFn) {
              proxyFn(val)
            }
          } else if (inReg.direction === 'inner-output' && inReg.pinType === 'joint') {//joint
            const cons = Cons[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
            if (cons) {
              exeCons(cons, val)
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

    cons.forEach(inReg => {
      let nextScope = curScope

      if (notifyAll) {
        const frameKey = inReg.frameKey
        if (!frameKey) {
          throw new Error(`数据异常，请检查toJSON结果.`)
        }
        if (frameKey === ROOT_FRAME_KEY) {//root作用域
          exeCon(inReg, {})
        } else {
          const ary = frameKey.split('-')
          if (ary.length >= 2) {
            const slotProps = getSlotProps(ary[0], ary[1])

            if (!slotProps.curScope) {//存在尚未执行的作用域插槽的情况，例如页面卡片中变量的赋值、驱动表单容器中同一变量的监听
              slotProps.pushTodo((curScope) => {
                if (curScope !== nextScope) {
                  nextScope = curScope
                }

                exeCon(inReg, nextScope)
              })
            } else {
              if (slotProps.curScope !== nextScope) {
                nextScope = slotProps.curScope
              }

              exeCon(inReg, nextScope)
            }
          }
        }
      } else {
        exeCon(inReg, nextScope)
      }
    })
  }

  function getComProps(comId,
                       scope?: { id: string, frameId: string, parent },
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
    while (curScope) {
      const key = curScope.id + '-' + comId

      if (curScope.frameId === com.frameId) {
        storeScopeId = curScope.id

        const found = frameProps[key]
        if (found) {
          return found
        } else {
          break
        }
      }

      curScope = curScope.parent
    }

    const key = (storeScopeId ? (storeScopeId + '-') : '') + comId

    const found = frameProps[key]//global
    if (found) {
      return found
    }

    // if (ioProxy) {
    //   console.log(comId, scope)
    // }

    //--------------------------------------------------------


    const def = com.def
    const model = com.model

    let nModel = opts ? JSON.parse(JSON.stringify(model)) : model
    const obsModel = observable(nModel)

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

    const inputs = function (ioProxy?: { inputs, outputs }) {
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

    const outputs = function (ioProxy?: { inputs, outputs }) {
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
          return function (val, _myScope, fromCon) {
            const notifyAll = typeof _myScope === 'boolean' && _myScope//变量组件的特殊处理

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
            logOutputVal(com.title, comDef, name, val)

            const evts = model.outputEvents
            let cons
            if (evts) {
              const eAry = evts[name]
              if (eAry && Array.isArray(eAry)) {
                const activeEvt = eAry.find(e => e.active)
                if (activeEvt) {
                  const { type } = activeEvt


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

                  // if (type === 'none') {
                  //   return
                  // }

                  // if (!['fx', 'defined'].includes(type)) {
                  //   if (Array.isArray(env?.events)) {
                  //     const def = env.events.find(ce => {
                  //       if (ce.type === type) {
                  //         return ce
                  //       }
                  //     })
                  //     if (def && typeof def.exe === 'function') {
                  //       def.exe({options: activeEvt.options})//与设计器中的使用方法对齐
                  //     }
                  //   }

                  //   return
                  // }

                  // if (type === 'fx') {
                  //   const proxyDesc = PinProxies[comId + '-' + name]
                  //   if (proxyDesc?.type === 'frame') {
                  //     cons = Cons[`${proxyDesc.frameId}-${proxyDesc.pinId}`]
                  //   }
                  // }
                }
              }
            }

            cons = cons || Cons[comId + '-' + name]
            if (cons?.length) {
              if (args.length >= 3) {//明确参数的个数，属于 ->in(com)->out
                exeCons(cons, val, myScope, fromCon)
              } else {//组件直接调用output（例如JS计算），严格来讲需要通过rels实现，为方便开发者，此处做兼容处理
                //myScope为空而scope不为空的情况，例如在某作用域插槽中的JS计算组件
                exeCons(cons, val, myScope || scope, fromCon, notifyAll)//检查frameScope
              }
            }
          }
        }
      })
    }

    const _inputs = new Proxy({}, {
      get(target, name, receiver) {
        return function (fn) {
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
          const cons = Cons[comId + '-' + name]
          if (cons) {
            logOutputVal(com.title, def, name, val)

            exeCons(cons, val, scope)

            // cons.forEach(inReg => {
            //   if (inReg.type === 'com') {
            //     exeInputForCom(inReg, val, scope)
            //   } else {
            //     throw new Error(`尚未实现`)
            //   }
            // })
          }
        }
      }
    })

    function _notifyBindings(val) {
      const { bindingsTo } = com.model
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

    const rtn = {
      title: com.title,
      frameId: com.frameId,
      parentComId: com.parentComId,
      data: obsModel.data,
      style: obsModel.style,
      _inputRegs: inputRegs,
      addInputTodo,
      inputs: inputs(),
      inputsCallable,
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
      onError
    }

    frameProps[key] = rtn

    return rtn
  }

  function exeInputForCom(inReg, val, scope, outputRels?) {
    const {comId, def, pinId, pinType, frameKey, finishPinParentKey} = inReg

    if (pinType === 'ext') {
      const props = _Props[comId] || getComProps(comId, scope)
      if (pinId === 'show') {
        props.style.display = ''
      } else if (pinId === 'hide') {
        props.style.display = 'none'
      } else if (pinId === 'showOrHide') {
        const sty = props.style
        if (sty.display === 'none') {
          sty.display = ''
        } else {
          sty.display = 'none'
        }

      }
    } else if (pinType === 'config') {
      const props = getComProps(comId, scope);
      const comDef = getComDef(def);
      logInputVal(props.title, comDef, pinId, val);
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
    } else {
      if (def.rtType?.match(/^js/gi)) {//js
        const jsCom = Coms[comId]
        if (jsCom) {
          const props = getComProps(comId, scope)
          const comDef = getComDef(def)
          const scopeId = scope?.id
          // const myId = (scope ? scope.id + '-' : '') + comId
          const myId = (scopeId ? scopeId + '-' : '') + comId
          logInputVal(props.title, comDef, pinId, val)

          if (!_exedJSCom[myId]) {
            _exedJSCom[myId] = true

            // 当存在组件实例时，使用组件实例的方法
            if (typeof comInstance?.[comId] === 'function') {
              comInstance[comId]({//exe once
                id: comId,
                env: _Env,
                data: props.data,
                inputs: props.inputs,
                outputs: props.outputs,
                _notifyBindings: props._notifyBindings,
                logger,
                onError
              })
            } else {
              comDef.runtime({//exe once
                id: comId,
                env: _Env,
                data: props.data,
                inputs: props.inputs,
                outputs: props.outputs,
                _notifyBindings: props._notifyBindings,
                logger,
                onError
              })
            }
          }

          const { realId, realVal, isReady, isMultipleInput } = transformInputId(inReg, val, props)
          
          // 当前pin为 多输入并且输入都已到达 或者 非多输入
          if ((isMultipleInput && isReady) || !isMultipleInput) {
            props._inputRegs[realId](realVal, new Proxy({}, {//relOutputs
              get(target, name) {
                return function (val) {
                  if (PinValueProxies) {
                    const pinValueProxy = PinValueProxies[`${comId}-${pinId}`]
                    if (pinValueProxy) {
                      val = _slotValue[`${frameKey}-${pinValueProxy.pinId}${scope ? `-${scope.id}-${scope.frameId}` : ''}`]
                    }
                  }
                  props.outputs[name](val, scope, inReg)
                  // const rels = _PinRels[id + '-' + pinId]
                  // if (rels) {
                  //   rels.forEach(relId => {
                  //     props.outputs[relId](val)
                  //   })
                  // }
                }
              }
            }))//invoke the input
          }
        }
      } else {//ui
        const props = getComProps(comId, scope)
        const comDef = getComDef(def)
        logInputVal(props.title, comDef, pinId, val)

        const { realId, realVal, isReady, isMultipleInput } = transformInputId(inReg, val, props)
        const fn = props._inputRegs[realId]

        // 当前pin为 多输入并且输入都已到达 或者 非多输入
        if ((isMultipleInput && isReady) || !isMultipleInput) {
          if (typeof fn === 'function') {
            let nowRels
            if (outputRels) {
              nowRels = outputRels
            } else {
              nowRels = new Proxy({}, {//relOutputs
                get(target, name) {
                  return function (val) {
                    props.outputs[name](val, scope, inReg)//with current scope
  
                    // const rels = _PinRels[id + '-' + pinId]
                    // if (rels) {
                    //   rels.forEach(relId => {
                    //     props.outputs[relId](val)
                    //   })
                    // }
                  }
                }
              })
            }
  
            fn(realVal, nowRels)//invoke the input,with current scope
          } else {
            props.addInputTodo(realId, realVal, inReg, scope)
          }
        }
      }
    }

    if (finishPinParentKey) {
      const cons = Cons[_nextConsPinKeyMap[finishPinParentKey]]
      if (cons && !PinRels[`${comId}-${pinId}`]) {
        exeCons(cons, void 0)
      }
    }
  }

  /**
   * 转换inputId,处理多输入配置
   */
  function transformInputId(inReg, val, props) {
    const { pinId, comId } = inReg
    const pidx = pinId.indexOf('.')

    if (pidx !== -1) {
      let realId = pinId.substring(0, pidx)
      const paramId = pinId.substring(pidx + 1)

      let barrier = _valueBarrier[comId]
      if (!barrier) {
        barrier = _valueBarrier[comId] = {}
      }

      barrier[paramId] = val

      const regExp = new RegExp(`${realId}.`)
      const allPins: string[] = Object.keys(props.inputs).filter((pin) => {
        return !!pin.match(regExp)
      })

      if (Object.keys(barrier).length === allPins.length) {

        delete _valueBarrier[comId]

        return {
          isMultipleInput: true,
          isReady: true,
          realId,
          realVal: barrier
        }
      } else {
        return {
          isMultipleInput: true,
          isReady: false
        }
      }
    }

    return {
      // 是否多输入
      isMultipleInput: false,
      // 多输入是否可执行
      isReady: true,
      // 最终调用的pinId
      realId: pinId,
      // 最终传递的值
      realVal: val
    }
  }

  function searchComInSlot(slot, comId) {
    if (slot.comAry) {
      return slot.comAry.find(com => {
        if (com.id === comId) {
          return com
        }
        if (com.slots) {
          for (let id in com.slots) {
            const found = searchComInSlot(com.slots[id], comId)
            if (found) {
              return found
            }
          }
        }
      })
    }
  }

  function getSlotProps(comId, slotId, scope) {
    const key = comId + '-' + slotId

    let rtn = _Props[key]
    if (!rtn) {
      const foundCom = searchComInSlot(UIRoot, comId)
      const slotDef = foundCom.slots[slotId]

      //const _outputRegs = {}
      const _inputRegs = {}

      const Cur = {scope, todo: void 0}//保存当前scope，在renderSlot中调用run方法会被更新

      const _inputs = new Proxy({}, {
        get(target, name) {
          return function (fn) {
            _inputRegs[name] = fn
          }
        }
      })

      const inputs = new Proxy({}, {
        get(target, name) {
          return function (val, curScope) {//set data
            const key = comId + '-' + slotId + '-' + name
            const cons = Cons[key]
            _slotValue[`${key}${curScope ? `-${curScope.id}-${curScope.frameId}` : ''}`] = val

            if (cons) {
              exeCons(cons, val, curScope || Cur.scope)

              // cons.forEach(inReg => {
              //   if (inReg.type === 'com') {
              //     exeInputForCom(inReg, val, curScope || Cur.scope)
              //   }
              // })
            }
          }
        }
      })

      const outputs = new Proxy({}, {
        get(target, name, receiver) {
          return function (fn) {//proxy for com's outputs
            _frameOutputProxy[key + '-' + name] = fn
            //_outputRegs[name] = fn
          }
        }
      })

      let runExed

      rtn = _Props[key] = {
        type: slotDef?.type,
        run(scope) {
          Cur.scope = scope//更新当前scope

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

          if (!runExed) {
            runExed = true//only once
            exeForFrame({comId, frameId: slotId, scope})
          }

          if (Array.isArray(Cur.todo)) {
            Cur.todo.forEach(fn => {
              fn(scope)
            })
            Cur.todo = void 0//执行完成清空
          }
        },
        //_outputRegs,
        _inputs,
        _inputRegs,
        inputs,
        outputs,
        get curScope() {
          return Cur.scope
        },
        pushTodo(fn) {
          if (!Cur.todo) {
            Cur.todo = []
          }
          Cur.todo.push(fn)
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
      autoAry.forEach(com => {
        const {id, def} = com
        const jsCom = Coms[id]
        if (jsCom) {
          const props = getComProps(id, scope)

          const comDef = getComDef(def)

          log(`${comDef.namespace} 开始执行`)

          // 当组件有实例时，优先执行实例
          if (typeof comInstance?.[id] === 'function') {
            comInstance[id]({
              id: id,
              env: _Env,
              data: props.data,
              inputs: props.inputs,
              outputs: props.outputs,
              logger,
              onError
            })
          } else {
            comDef.runtime({
              id: id,
              env: _Env,
              data: props.data,
              inputs: props.inputs,
              outputs: props.outputs,
              logger,
              onError
            })
          }
        }
      })
    }
  }

  function exeInputForFrame(opts, val, scope?) {
    const {frameId, comId, pinId} = opts

    const idPre = comId ? `${comId}-${frameId}` : `${frameId}`

    const cons = Cons[idPre + '-' + pinId]
    if (cons) {
      exeCons(cons, val, scope)
    }
  }

  if (typeof ref === 'function') {
    ref({
      run() {
        exeForFrame({frameId: ROOT_FRAME_KEY})
      },
      inputs: new Proxy({}, {
        get(target, pinId) {
          return function (val) {
            exeInputForFrame({frameId: ROOT_FRAME_KEY, pinId,}, val)
          }
        }
      }),
      outputs(id, fn) {
        _frameOutput[id] = fn;
      }
    })
  }

  return {
    get(comId: string, _slotId: string, scope: { id: string }, _ioProxy) {
      let slotId, curScope, ioProxy
      for (let i = 0; i < arguments.length; i++) {
        const arg = arguments[i]
        if (i > 0 && typeof arg === 'string') {
          slotId = arg
        }

        if (typeof arg === 'object') {
          if (arg.inputs || arg.outputs || arg._inputs || arg._outputs) {//ioProxy
            ioProxy = arg
          } else if (arg.id || arg.parent) {//scope
            curScope = arg
          }
        }
      }

      if (slotId) {
        return getSlotProps(comId, slotId, curScope)
      } else {
        const rtn = getComProps(comId, curScope)
        if (ioProxy) {
          return rtn.clone(ioProxy)
        } else {
          return rtn
        }
      }
    }
  }
}