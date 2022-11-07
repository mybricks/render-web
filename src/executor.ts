/**
 * MyBricks Opensource
 * https://mybricks.world
 * This source code is licensed under the MIT license.
 *
 * CheMingjun @2019
 * mybricks@126.com
 */


export default function init(opts, {observable}) {
  const {comDefs, env, ref} = opts
  const _ComDefs = comDefs
  const _Env = env

  const _Props = {}

  const _frameOutputProxy = {}

  let _Coms
  let _ComsAutoRun
  let _Cons
  let _PinRels

  function _log(msg) {
    console.log('【Mybricks】' + msg)
  }

  function _getComDef(def) {
    return _ComDefs[def.namespace + '-' + def.version]
  }

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

    const exeCons = (cons, val) => {
      if (cons) {
        cons.forEach(inReg => {
          if (inReg.type === 'com') {
            _exeInputForCom(inReg, val, scope)
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
        return function (val) {
          const cons = _Cons[comId + '-' + name]
          exeCons(cons, val)
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

    let rtn = _Props[key] = {
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

    return rtn
  }

  function _exeInputForCom(inReg, val, scope, outputRels?) {
    const {id, def, pinId, pinType} = inReg

    if (pinType === 'ext') {
      const props = _Props[id]
      if (pinId === 'show') {
        props.style.display = ''
      } else if (pinId === 'hide') {
        props.style.display = 'none'
      }
    } else {
      if (def.rtType) {
        if (def.rtType.match(/^js/gi)) {//js
          const jsCom = _Coms[id]
          if (jsCom) {
            const props = _getComProps(id, scope)

            const comDef = _getComDef(def)

            _log(`${comDef.namespace} | ${pinId} -> ${val}`)

            comDef.runtime({
              env: _Env,
              data: props.data,
              inputs: props.inputs,
              outputs: props.outputs
            })

            props._inputRegs[pinId](val, new Proxy({}, {//relOutputs
              get(target, name) {
                return function (val) {
                  props.outputs[name](val)
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
        const props = _getComProps(id, scope)

        const comDef = _getComDef(def)

        _log(`${comDef.namespace} | ${pinId} -> ${val}`)

        const fn = props._inputRegs[pinId]
        if (typeof fn === 'function') {
          let nowRels
          if (outputRels) {
            nowRels = outputRels
          } else {
            nowRels = new Proxy({}, {//relOutputs
              get(target, name) {
                return function (val) {
                  props.outputs[name](val)

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

          fn(val, nowRels)//invoke the input
        } else {
          props.addInputTodo(pinId, val)
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

          const comDef = _getComDef(def)

          _log(`${comDef.namespace} | (autorun)`)

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

  return (args: any) => {
    _Coms = args.Coms
    _ComsAutoRun = args.ComsAutoRun
    _Cons = args.Cons
    _PinRels = args.PinRels

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
        })
      })
    }

    return {
      _getSlotProps, _getComProps
    }
  }
}