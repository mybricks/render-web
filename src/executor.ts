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
    pinProxies: PinProxies
  } = json

  const _Env = env

  const _Props = {}

  const _frameOutputProxy = {}

  const _exedJSCom = {}

  const _frameOutput = {}

  function exeCons(cons, val, curScope, fromCon?, notifyAll?) {
    function exeCon(inReg, nextScope) {
      const proxyDesc = PinProxies[inReg.comId + '-' + inReg.pinId]
      if (proxyDesc) {
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
            if(cons){
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
        throw new Error(`????????????`)
      }
    }

    cons.forEach(inReg => {
      let nextScope = curScope

      if (notifyAll) {
        const frameKey = inReg.frameKey
        if (!frameKey) {
          throw new Error(`????????????????????????toJSON??????.`)
        }
        if (frameKey === ROOT_FRAME_KEY) {//root?????????
          exeCon(inReg, nextScope)
        } else {
          const ary = frameKey.split('-')
          if (ary.length >= 2) {
            const slotProps = getSlotProps(ary[0], ary[1])

            if (!slotProps.curScope) {//?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
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

    // if (comId === 'u_HERyF') {
    //   debugger
    //   console.log('==>curScope', scope)
    // }

    const com = Coms[comId]
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
            if (proxiedInputs) {//?????????????????????
              const proxy = proxiedInputs[name]
              if (typeof proxy === 'function') {
                proxy(fn)
              }
            }

            // if (comId === 'u_DVT7M'&&name==='getTableData') {
            //   debugger
            //   console.log('==>curScope', scope)
            // }

            inputRegs[name] = fn
            const ary = inputTodo[name]
            if (ary) {
              ary.forEach(({val, fromCon, fromScope}) => {
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
            const notifyAll = typeof _myScope === 'boolean' && _myScope//???????????????????????????

            const args = arguments
            const proxiedOutputs = ioProxy?.outputs
            if (proxiedOutputs) {//?????????????????????
              const proxy = proxiedOutputs[name]
              if (typeof proxy === 'function') {
                proxy(val)
              }
            }

            let myScope
            if (_myScope && typeof _myScope === 'object') {//???????????????output?????????????????????
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
                    if (Array.isArray(env?.events)) {
                      const def = env.events.find(ce => {
                        if (ce.type === activeEvt.type) {
                          return ce
                        }
                      })
                      if (def && typeof def.exe === 'function') {
                        def.exe({options: activeEvt.options})//????????????????????????????????????
                      }
                    }

                    return
                  }
                }
              }
            }

            const cons = Cons[comId + '-' + name]
            if(cons){
              if (args.length >= 3) {//?????????????????????????????? ->in(com)->out
                exeCons(cons, val, myScope, fromCon)
              } else {//??????????????????output?????????JS????????????????????????????????????rels???????????????????????????????????????????????????
                //myScope?????????scope??????????????????????????????????????????????????????JS????????????
                exeCons(cons, val, myScope || scope, fromCon, notifyAll)//??????frameScope
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
            //     throw new Error(`????????????`)
            //   }
            // })
          }
        }
      }
    })

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
      logger,
      onError
    }

    frameProps[key] = rtn

    return rtn
  }

  function exeInputForCom(inReg, val, scope, outputRels?) {
    const {comId, def, pinId, pinType} = inReg

    // if (comId === 'u_liDBH') {
    //   debugger
    // }

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
       * ????????????????????????extBinding?????????
       * ?????????extBinding???data.text
       * ?????????props.data.text = val
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

        // if (comId === 'u_DVT7M') {
        //   debugger
        //   console.log('==>curScope', scope)
        // }

        const comDef = getComDef(def)

        logInputVal(props.title, comDef, pinId, val)

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
          props.addInputTodo(pinId, val, inReg, scope)
        }
      }
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

      const Cur = {scope, todo: void 0}//????????????scope??????renderSlot?????????run??????????????????

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
            const cons = Cons[comId + '-' + slotId + '-' + name]
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
          Cur.scope = scope//????????????scope

          // for(let cid in Cons){
          //   const cons = Cons[cid]
          //   if(cons){
          //     cons.forEach(con=>{
          //       //con._exeScope = void 0
          //       if(con.frameKey===key){
          //         //debugger
          //         con._exeScope = scope//?????????????????????scope
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
            Cur.todo = void 0//??????????????????
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

          log(`${comDef.namespace} ????????????`)

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

      // if(comId==='u_CEodv'){
      //   console.log('curScope::',curScope)
      // }


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