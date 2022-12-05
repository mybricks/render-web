import pkg from "../package.json";

/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */

export default function init(opts, {observable}) {
  const {
    json,
    getComDef,
    env,
    events,
    ref,
    onError,
    logger
  } = opts

  const {
    coms: Coms,
    comsAutoRun: ComsAutoRun,
    cons: Cons,
    pinRels: PinRels,
    pinProxies: PinProxies
  } = json

  const _Env = env

  const _Props = {}

  const _frameOutputProxy = {}

  const _exedJSCom = {}

  const _frameOutput = {}

  function exeCons(cons, val, curScope, fromCon?) {
    if (cons) {
      cons.forEach(inReg => {
        // if (inReg.comId === 'u_WXrNp') {
        //   debugger
        // }


        const proxyDesc = PinProxies[inReg.comId + '-' + inReg.pinId]
        if (proxyDesc) {
          if (proxyDesc.type === 'frame') {//call fx frame
            const comProps = getComProps(inReg.comId, curScope)
            let myScope
            //if (!curScope) {////TODO 待严格测试
            myScope = {
              id: inReg.comId,
              frameId: proxyDesc.frameId,
              parent: curScope,
              proxyComProps: comProps//current proxied component instance
            }
            //}

            exeInputForFrame(proxyDesc, val, myScope)
            return
          }
        }

        if (inReg.type === 'com') {
          if (fromCon) {
            if (fromCon.finishPinParentKey === inReg.startPinParentKey) {//same scope,rels
              exeInputForCom(inReg, val, curScope)
            }
          } else {
            exeInputForCom(inReg, val, curScope)
          }
        } else if (inReg.type === 'frame') {//frame-inner-input -> com-output proxy,exg dialog
          if (inReg.comId) {
            if (inReg.direction === 'inner-input') {
              const proxyFn = _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
              if (proxyFn) {
                proxyFn(val)
              }
            } else if (inReg.direction === 'inner-output' && inReg.pinType === 'joint') {//joint
              const cons = Cons[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
              exeCons(cons, val)
            }
          } else {
            const proxiedComProps = curScope?.proxyComProps
            if (proxiedComProps) {

              const outPin = proxiedComProps.outputs[inReg.pinId]
              if (outPin) {
                outPin(val, curScope.parent)
                return
              }
            }

            _frameOutput[inReg.pinId]?.(val)
          }
        } else {
          throw new Error(`尚未实现`)
        }
      })
    }
  }

  function getComProps(comId,
                       scope?: { id: string, frameId: string, parent },
                       //ioProxy?: { inputs, outputs, _inputs, _outputs }
  ) {
    // if(ioProxy){
    //   console.log(comId,scope)
    // }

    // if (comId === 'u_npG0S') {
    //   debugger
    //
    //   console.log('==>curScope', scope)
    // }

    const com = Coms[comId]
    const comInFrameId = comId + (com.frameId || '_rootFrame_')

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
        }else{
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

    const addInputTodo = (inputId, val, fromCon) => {
      let ary = inputTodo[inputId]
      if (!ary) {
        inputTodo[inputId] = ary = []
      }
      ary.push({val, fromCon})
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

            //else {////TODO 待严格测试
            inputRegs[name] = fn
            const ary = inputTodo[name]
            if (ary) {
              ary.forEach(({val, fromCon}) => {
                // if (fromCon) {
                //   if (fromCon.finishPinParentKey === inReg.startPinParentKey) {//same scope,rels
                //
                //   }
                // }


                fn(val, new Proxy({}, {//relOutputs
                  get(target, name) {
                    return function (val) {
                      const fn = outputs()[name]
                      if (typeof fn === 'function') {
                        fn(val, curScope, fromCon)
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
            if (evts) {
              const eAry = evts[name]
              if (eAry && Array.isArray(eAry)) {
                const activeEvt = eAry.find(e => e.active)
                if (activeEvt) {
                  if (activeEvt.type === 'none') {
                    return
                  }

                  if (activeEvt.type !== 'defined') {
                    if (Array.isArray(events)) {
                      const def = events.find(ce => {
                        if (ce.type === activeEvt.type) {
                          return ce
                        }
                      })
                      if (def && typeof def.exe === 'function') {
                        def.exe(activeEvt.options)
                      }
                    }

                    return
                  }
                }
              }
            }

            const cons = Cons[comId + '-' + name]

            if (args.length >= 3) {//明确参数的个数，属于 ->in(com)->out
              exeCons(cons, val, myScope, fromCon)
            } else {//组件直接调用output（例如JS计算），严格来讲需要通过rels实现，为方便开发者，此处做兼容处理
              //myScope为空而scope不为空的情况，例如在某作用域插槽中的JS计算组件
              exeCons(cons, val, myScope || scope, fromCon)
              //exeCons(cons, val, myScope, fromCon)/////TODO
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

            cons.forEach(inReg => {
              if (inReg.type === 'com') {
                exeInputForCom(inReg, val, scope)
              } else {
                throw new Error(`尚未实现`)
              }
            })
          }
        }
      }
    })

    const rtn = {
      title: com.title,
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
      logger,
      onError
    }

    frameProps[key] = rtn

    return rtn
  }

  function exeInputForCom(inReg, val, scope, outputRels?) {
    const {comId, def, pinId, pinType} = inReg

    if (pinType === 'ext') {
      const props = _Props[comId] || getComProps(comId, scope)
      if (pinId === 'show') {
        props.style.display = ''
      } else if (pinId === 'hide') {
        props.style.display = 'none'
      }
    } else {
      if (def.rtType?.match(/^js/gi)) {//js
        const jsCom = Coms[comId]
        if (jsCom) {
          const props = getComProps(comId, scope)

          const comDef = getComDef(def)

          logInputVal(props.title, comDef, pinId, val)

          const myId = (scope ? scope.id + '-' : '') + comId

          if (!_exedJSCom[myId]) {
            _exedJSCom[myId] = true

            comDef.runtime({//exe once
              env: _Env,
              data: props.data,
              inputs: props.inputs,
              outputs: props.outputs,
              logger,
              onError
            })
          }

          props._inputRegs[pinId](val, new Proxy({}, {//relOutputs
            get(target, name) {
              return function (val) {
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
      } else {//ui
        const props = getComProps(comId, scope)

        const comDef = getComDef(def)

        logInputVal(props.title, comDef, pinId, val)

        if (pinType === 'config') {
          /**
           * 配置项类型，根据extBinding值操作
           * 例如：extBinding：data.text
           * 结果：props.data.text = val
           */
          const {extBinding} = inReg
          const ary = extBinding.split('.')
          let nowObj = props

          ary.forEach((nkey, idx) => {
            if (idx !== ary.length - 1) {
              nowObj = nowObj[nkey]
            } else {
              nowObj[nkey] = val
            }
          })
        } else {
          const fn = props._inputRegs[pinId]
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

            fn(val, nowRels)//invoke the input,with current scope
          } else {
            props.addInputTodo(pinId, val, inReg)
          }
        }
      }
    }
  }

  function getSlotProps(comId, slotId) {
    const key = comId + '-' + slotId

    let rtn = _Props[key]
    if (!rtn) {
      //const _outputRegs = {}

      const inputs = new Proxy({}, {
        get(target, name) {
          return function (val, scope) {//set data
            // if(!scope){
            //   //debugger
            //
            //   scope = {////TODO
            //     id: comId+Math.random(),
            //     frameId: slotId
            //   }
            // }

            const cons = Cons[comId + '-' + slotId + '-' + name]
            if (cons) {
              cons.forEach(inReg => {
                if (inReg.type === 'com') {
                  exeInputForCom(inReg, val, scope)
                }
              })
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
        run() {
          if (!runExed) {
            runExed = true//only once
            exeForFrame({comId, frameId: slotId})
          }
        },
        //_outputRegs,
        inputs,
        outputs
      }
    }

    return rtn
  }

  function exeForFrame(opts) {
    const {comId, frameId} = opts
    const idPre = comId ? `${comId}-${frameId}` : `${frameId}`

    const autoAry = ComsAutoRun[idPre]
    if (autoAry) {
      autoAry.forEach(com => {
        const {id, def} = com
        const jsCom = Coms[id]
        if (jsCom) {
          const props = getComProps(id)

          const comDef = getComDef(def)

          log(`${comDef.namespace} 开始执行`)

          comDef.runtime({
            env: _Env,
            data: props.data,
            inputs: props.inputs,
            outputs: props.outputs,
            logger,
            onError
          })
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
        exeForFrame({frameId: '_rootFrame_'})
      },
      inputs: new Proxy({}, {
        get(target, pinId) {
          return function (val) {
            exeInputForFrame({frameId: '_rootFrame_', pinId}, val)
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

      // if(comId==='u_CEodv'){
      //   console.log('curScope::',curScope)
      // }


      if (slotId) {
        return getSlotProps(comId, slotId)
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

function log(msg) {
  console.log(`%c[Mybricks]%c ${msg}\n`, `color:#FFF;background:#fa6400`, ``, ``);
}

function logInputVal(comTitle, comDef, pinId, val) {
  let tval
  try {
    tval = JSON.stringify(val)
  } catch (ex) {
    tval = val
  }

  console.log(`%c[Mybricks] 输入项 %c ${comTitle || comDef.title || comDef.namespace} | ${pinId} -> ${tval}`, `color:#FFF;background:#000`, ``, ``);
}

function logOutputVal(comTitle, comDef, pinId, val) {
  let tval
  try {
    tval = JSON.stringify(val)
  } catch (ex) {
    tval = val
  }

  console.log(`%c[Mybricks] 输出项 %c ${comTitle || comDef.title || comDef.namespace} | ${pinId} -> ${tval}`, `color:#FFF;background:#fa6400`, ``, ``);
}