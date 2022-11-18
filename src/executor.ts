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
  const {json, getComDef, env, events, ref} = opts
  const _Coms = json.coms
  const _ComsAutoRun = json.comsAutoRun
  const _Cons = json.cons
  const _PinRels = json.pinRels

  const _Env = env

  const _Props = {}

  const _frameOutputProxy = {}

  const _exedJSCom = {}

  function _log(msg) {
    console.log(`%c[Mybricks]%c ${msg}\n`, `color:#FFF;background:#fa6400`, ``, ``);
  }

  function logInputVal(comDef, pinId, val) {
    let tval
    try {
      tval = JSON.stringify(val)
    } catch (ex) {
      tval = val
    }

    console.log(`%c[Mybricks] 输入项 %c ${comDef.title || comDef.namespace} | ${pinId} -> ${tval}`, `color:#FFF;background:#000`, ``, ``);
  }

  function logOutputVal(comDef, pinId, val) {
    let tval
    try {
      tval = JSON.stringify(val)
    } catch (ex) {
      tval = val
    }

    console.log(`%c[Mybricks] 输出项 %c ${comDef.title || comDef.namespace} | ${pinId} -> ${tval}`, `color:#FFF;background:#fa6400`, ``, ``);
  }

  const _frameOutput = {};

  function _getComProps(comId, scope?: { id: string }) {//with opts:{scopeId}
    let tnow = scope?.id || ''
    while (true) {
      const pre = tnow !== '' ? (tnow + '-') : tnow
      const key = pre + comId

      const found = _Props[key]
      if (found) {
        return found
      }

      if (tnow !== '') {
        tnow = tnow.substring(0, tnow.lastIndexOf('/'))
      } else {
        break
      }
    }

    //--------------------------------------------------------

    const key = (scope ? (scope.id + '-') : '') + comId

    const com = _Coms[comId]
    const def = com.def
    const model = com.model

    let nModel = opts ? JSON.parse(JSON.stringify(model)) : model
    const obsModel = observable(nModel)

    const inputRegs = {}
    const inputTodo = {}

    const _inputRegs = {}
    const _inputTodo = {}

    const addInputTodo = (inputId, val) => {
      let ary = inputTodo[inputId]
      if (!ary) {
        inputTodo[inputId] = ary = []
      }
      ary.push(val)
    }

    const inputs = new Proxy({}, {
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
          inputRegs[name] = fn
          const ary = inputTodo[name]
          if (ary) {
            ary.forEach(val => {
              fn(val, new Proxy({}, {//relOutputs
                get(target, name) {
                  return function (val) {
                    outputs[name](val)
                  }
                }
              }))
            })
            inputTodo[name] = void 0
          }
        }
      }
    })

    const inputsCallable = new Proxy({}, {
      get(target, name) {
        return function (val) {
          const rels = _PinRels[comId + '-' + name]
          if (rels) {
            const rtn = {}
            const reg = {}

            rels.forEach(relId => {
              rtn[relId] = proFn => {
                reg[relId] = proFn
              }
            })

            Promise.resolve().then(() => {
              const inReg = {id: comId, def, pinId: name}
              _exeInputForCom(inReg, val, scope, reg)
            })

            return rtn
          } else {
            const inReg = {id: comId, def, pinId: name}
            _exeInputForCom(inReg, val, scope)
          }
        }
      }
    })

    const exeCons = (cons, val, curScope, fromCon) => {
      if (cons) {
        cons.forEach(inReg => {
          if (inReg.type === 'com') {
            if (fromCon) {
              if (fromCon.finishPinParentKey === inReg.startPinParentKey) {//same scope,rels
                _exeInputForCom(inReg, val, curScope || scope)
              }
            } else {
              _exeInputForCom(inReg, val, curScope || scope)
            }

          } else if (inReg.type === 'frame') {//frame-inner-input -> com-output proxy,exg dialog
            if (inReg.comId) {
              if (inReg.direction === 'inner-input') {
                const proxyFn = _frameOutputProxy[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
                if (proxyFn) {
                  proxyFn(val)
                }
              } else if (inReg.direction === 'inner-output' && inReg.pinType === 'joint') {//joint
                const cons = _Cons[inReg.comId + '-' + inReg.frameId + '-' + inReg.pinId]
                exeCons(cons, val)
              }
            } else {
              _frameOutput[inReg.pinId]?.(val)
            }
          } else {
            throw new Error(`尚未实现`)
          }
        })
      }
    }

    const outputs = new Proxy({}, {
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
        return function (val, scope, fromCon) {
          const comDef = getComDef(def)
          logOutputVal(comDef, name, val)

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

          const cons = _Cons[comId + '-' + name]
          exeCons(cons, val, scope, fromCon)
        }
      }
    })

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
          const cons = _Cons[comId + '-' + name]
          if (cons) {
            logOutputVal(def, name, val)

            cons.forEach(inReg => {
              if (inReg.type === 'com') {
                _exeInputForCom(inReg, val, scope)
              } else {
                throw new Error(`尚未实现`)
              }
            })
          }
        }
      }
    })

    return _Props[key] = {
      data: obsModel.data,
      style: obsModel.style,
      _inputRegs: inputRegs,
      addInputTodo,
      inputs,
      inputsCallable,
      outputs,
      _inputs,
      _outputs
    }
  }

  function _exeInputForCom(inReg, val, scope, outputRels?) {
    const {id, def, pinId, pinType} = inReg

    if (pinType === 'ext') {
      const props =  _Props[id] || _getComProps(id, scope)
      if (pinId === 'show') {
        props.style.display = ''
      } else if (pinId === 'hide') {
        props.style.display = 'none'
      }
    } else {
      if (def.rtType?.match(/^js/gi)) {//js
        const jsCom = _Coms[id]
        if (jsCom) {
          const props = _getComProps(id, scope)

          const comDef = getComDef(def)

          logInputVal(comDef, pinId, val)

          const myId = (scope ? scope.id + '-' : '') + id

          if (!_exedJSCom[myId]) {
            _exedJSCom[myId] = true

            comDef.runtime({//exe once
              env: _Env,
              data: props.data,
              inputs: props.inputs,
              outputs: props.outputs
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
        const props = _getComProps(id, scope)

        const comDef = getComDef(def)

        logInputVal(comDef, pinId, val)

        if (pinType === 'config') {
          /**
           * 配置项类型，根据extBinding值操作
           * 例如：extBinding：data.text
           * 结果：props.data.text = val
           */
          const { extBinding } = inReg
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
            props.addInputTodo(pinId, val)
          }
        }
      }
    }
  }

  function _getSlotProps(comId, slotId) {
    const key = comId + '-' + slotId

    let rtn = _Props[key]
    if (!rtn) {
      //const _outputRegs = {}

      const inputs = new Proxy({}, {
        get(target, name) {
          return function (val, scope) {//set data
            const cons = _Cons[comId + '-' + slotId + '-' + name]
            if (cons) {
              cons.forEach(inReg => {
                if (inReg.type === 'com') {
                  _exeInputForCom(inReg, val, scope)
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
            _exeForFrame({comId, frameId: slotId})
          }
        },
        //_outputRegs,
        inputs,
        outputs
      }
    }

    return rtn
  }

  function _exeForFrame(opts) {
    const {comId, frameId} = opts
    const idPre = comId ? `${comId}-${frameId}` : `${frameId}`

    const autoAry = _ComsAutoRun[idPre]
    if (autoAry) {
      autoAry.forEach(com => {
        const {id, def} = com
        const jsCom = _Coms[id]
        if (jsCom) {
          const props = _getComProps(id)

          const comDef = getComDef(def)

          _log(`${comDef.namespace} 开始执行`)

          comDef.runtime({
            env: _Env,
            data: props.data,
            inputs: props.inputs,
            outputs: props.outputs
          })
        }
      })
    }
  }

  function _exeInputForFrame(opts, val, scope?) {
    const {frameId, comId, pinId} = opts
    const idPre = comId ? `${comId}-${frameId}` : `${frameId}`

    const cons = _Cons[idPre + '-' + pinId]
    if (cons) {
      cons.forEach(inReg => {
        if (inReg.type === 'com') {
          _exeInputForCom(inReg, val, scope)
        } else {
          throw new Error(`尚未实现`)
        }
      })
    }
  }

  if (typeof ref === 'function') {
    ref({
      run() {
        _exeForFrame({frameId: '_rootFrame_'})
      },
      inputs: new Proxy({}, {
        get(target, pinId) {
          return function (val) {
            _exeInputForFrame({frameId: '_rootFrame_', pinId}, val)
          }
        }
      }),
      outputs(id, fn) {
        _frameOutput[id] = fn;
      }
    })
  }

  return {
    get(comId: string, _slotId: string, _scope: { id: string }) {
      let slotId, scope
      for (let i = 0; i < arguments.length; i++) {
        if (i > 0 && typeof arguments[i] === 'string') {
          slotId = arguments[i]
        }
        if (typeof arguments[i] === 'object') {
          scope = arguments[i]
        }
      }

      if (slotId) {
        return _getSlotProps(comId, slotId)
      } else {
        return _getComProps(comId, scope)
      }
    }
  }
}