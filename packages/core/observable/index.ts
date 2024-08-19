import React, {
  memo,
  useState,
  useEffect,
} from "react";
import { isObject, pxToRem } from "../utils";

const globalKey = "__render-web-createElement__";
let createElement: any;

/**
 * 劫持 React.createElement 函数
 */
export function hijackReactcreateElement(props: any) {
  const { pxToRem: configPxToRem, pxToVw: handlePxToVw } = props
  // @ts-ignore
  if (!React[globalKey]) {
    // @ts-ignore
    React[globalKey] = true;
    createElement = React.createElement;

    React.createElement = function(...args: any) {
      let [fn, props] = args;
      if (props) {
        const style = props.style
        if (configPxToRem && style) {
          Object.keys(style).forEach((key) => {
            const value = style[key]
  
            if (typeof value === 'string' && value.indexOf('px') !== -1) {
              style[key] = pxToRem(value)
            }
          })
        } else if (handlePxToVw && style) {
          Object.keys(style).forEach((key) => {
            const value = style[key]
            if (typeof value === 'string' && value.indexOf('px') !== -1) {
              style[key] = handlePxToVw(value)
            }
          })
        }
        if (props.__no_hijack__) {
          return createElement(...args)
        }

        if (args.length > 0 && typeof fn === "function") {
          if (!fn.prototype ||
            !(fn.prototype instanceof React.Component) && fn.prototype.isReactComponent === void 0) {
              const enCom = enhanceComponent(fn)
              args.splice(0, 1, enCom)
            }
            return createElement(...args)
        } else if (typeof fn === 'object' && fn.$$typeof === Symbol.for('react.forward_ref')) {
          // const enCom = enhanceComponent(fn, true)
          // args.splice(0, 1, enCom)

          return createElement(...args);
        } else {
          return createElement(...args);
        }
      }

      return createElement(...args); 
    };
  }
}

const PROP_ENHANCED = `__enhanced__`

function enhanceComponent(fn: any, isRefCom = false) {
  let obFn = fn[PROP_ENHANCED]

  if (!obFn) {
    if (isRefCom) {
      obFn = memo(fn)
      obFn.render = enhance(fn.render, false)
    } else {
      obFn = enhance(fn)
    }

    try {
      fn[PROP_ENHANCED] = obFn
    } catch (ex) {

    }
  }

  const props = Object.getOwnPropertyNames(fn)
  props && props.forEach(prop => {
    try {
      if (!(isRefCom && prop === 'render')) {
        obFn[prop] = fn[prop]
      }
    } catch (ex) {
      console.error(ex)
    }
  })

  return obFn
}

function enhance(component: any, memoIt = true) {
  function hoc (props: any, refs: any) {
    const [, setState] = useState([]);
  
    useEffect(() => {
      return () => {
        // TODO: 这里有个奇怪的销毁问题
        destroy(setState);
      };
    }, []);
  
    let render;

    run({
      update: setState,
      run: () => {
        render = component(props, refs);
      }
    })
  
    return render;
  }

  hoc.displayName = component.displayName || component.name

  return memoIt ? memo(hoc) : hoc
}

let obId = 0;

const updates: any[] = [];

// @ts-ignore
// window._updates = () => updates;

const run = ({
  update, // 依赖变更触发的事件
  run // 执行收集依赖
}: any) => {
  updates.unshift(update);
  run();
  const index = updates.indexOf(update);
  if (index !== -1) {
    updates.splice(index, 1);
  }
}

const destroy = (update: any) => {
  dep.destroy(update);
}

let _obRegex = /^_ob\d+_/;

const dep: any = {
  _obToKey: {}, 
  event: {},
  reverse: new WeakMap(),
  on(_ob: any, key: any, fn: any) {
    const { _obToKey, event, reverse } = this;
    const _obKey = _ob + key;

    if (!_obToKey[_ob]) {
      // 没有对应_ob+prop，创建一个set
      _obToKey[_ob] = new Set();
    }
    _obToKey[_ob].add(_obKey);

    if (!event[_obKey]) {
      // 没有对应_ob+prop，创建一个set
      event[_obKey] = new Set();
    }
    // 添加fn
    event[_obKey].add(fn);

    if (!reverse.get(fn)) {
      // fn反向查询_ob+prop
      reverse.set(fn, new Set());
    }
    // 添加_obKey
    reverse.get(fn).add(_obKey);
  },
  emit(key: any, args: any) {
    const fns = new WeakSet();
    // 根据_ob+prop找到fn
    const events = this.event[key];
    if (!events) return;
    // 遍历执行fn
    events.forEach((fn: any) => {
      if (fns.has(fn)) return;
      fns.add(fn);
      fn(args);
    });
  },
  destroy(fn: any) {
    const { reverse } = this;
    const eventKeys = reverse.get(fn);
    if (eventKeys) {
      const { event, _obToKey } = this;
      eventKeys.forEach((eventKey: string) => {
        const events = event[eventKey];
        const _ob = eventKey.match(_obRegex)![0];
        const keys = _obToKey[_ob];
        if (keys) {
          keys.delete(eventKey);
          if (!keys.size) {
            Reflect.deleteProperty(_obToKey, _ob);
          }
        }
        events.delete(fn)
        if (!events.size) {
          Reflect.deleteProperty(event, eventKey)
        }
      })
      reverse.delete(fn);
    }
  },
  destroy2(_ob: any) {
    const { _obToKey, event, reverse } = this;
    const keys = _obToKey[_ob];
    if (keys) {
      keys.forEach((key: any) => {
        const events = event[key];
        events.forEach((fn: any) => {
          const keys = reverse.get(fn);
          if (keys) {
            keys.delete(key)
            if (!keys.size) {
              reverse.delete(fn)
            }
          }
        })
        Reflect.deleteProperty(event, key)
      })
      Reflect.deleteProperty(_obToKey, _ob);
    }
  }
};

// const dep: any = {
//   event: {},
//   reverse: new WeakMap(),
//   on(key: any, fn: any) {
//     if (!this.event[key]) {
//       // 没有对应_ob+prop，创建一个set
//       this.event[key] = new Set();
//     }
//     // 添加fn
//     this.event[key].add(fn);

//     if (!this.reverse.get(fn)) {
//       // fn反向查询_ob+prop
//       this.reverse.set(fn, new Set());
//     }
//     // 添加key
//     this.reverse.get(fn).add(key);
//   },
//   emit(key: any, args: any) {
//     const fns = new WeakSet();
//     // 根据_ob+prop找到fn
//     const events = this.event[key];
//     if (!events) return;
//     // 遍历执行fn
//     events.forEach((fn: any) => {
//       if (fns.has(fn)) return;
//       fns.add(fn);
//       fn(args);
//     });
//   },
//   destroy(fn: any) {
//     const eventKeys = this.reverse.get(fn);
//     if (eventKeys) {
//       const { event } = this;
//       eventKeys.forEach((eventKey: string) => {
//         const events = event[eventKey];
//         events.delete(fn)
//         if (!events.size) {
//           Reflect.deleteProperty(event, eventKey)
//         }
//       })
//       this.reverse.delete(fn);
//     }
//   }
// };

// @ts-ignore
// window._getDep = () => {
//   return {
//     dep,
//     eventLength: Object.keys(dep.event).length,
//     _obToKey: Object.keys(dep._obToKey).length,
//   }
// }

/** 内容变更，原先对象上的监听需要删除 */
const destroy2 = (value: any) => {
  if (value?._ob) {
    dep.destroy2(value._ob);
    Object.entries(value).forEach(([, value]) => {
      destroy2(value);
    })
  }
}

// const a = new Proxy([], {
//   get(target, key) {
//     console.log("get: ", {
//       target,
//       key
//     })
//     return Reflect.get(target, key)
//   },
//   set(target, key, value) {
//     Reflect.set(target, key, value)
//     console.log("set: ", {
//       target, key, value
//     })
//     return true;
//   }
// })

const handler: ProxyHandler<any> = {
  set(target: any, prop: any, newValue: any, receiver: any) {
    const previousValue = Reflect.get(target, prop, receiver);
    const result = Reflect.set(target, prop, newValue, receiver);
    if (previousValue !== newValue || (Array.isArray(target) && prop === "length")) {
      dep.emit(target._ob + prop, []);
      destroy2(previousValue);
    }
    return result;
  },
  get(target: any, prop: any, receiver: any) {
    const result = Reflect.get(target, prop, receiver);

    if (["_ob", "constructor", Symbol.toPrimitive, Symbol.toStringTag, Symbol.iterator].includes(prop)) {
      return result
    }

    const currentRun = updates[0];

    if (currentRun) {
      if (Reflect.get(target, "__model_style__", receiver)) {
        if (prop === "display") {
          dep.on(target._ob, prop, currentRun)
        } else if (prop === "styleAry") {
          return result
        }
      } else {
        dep.on(target._ob, prop, currentRun)
      }
    }
    if (isObject(result)) {
      if (result._ob) {
        return result
      } else {
        const observableResult = observable(result);
        Reflect.set(target, prop, observableResult, receiver);
        return observableResult
      }
    }

    return result
  }
}

export function observable<T extends object & {_ob: string}>(obj: T): T {
  if (obj._ob) {
    return obj
  } else {
    // obj._ob = `_ob${++obId}_`;
    Object.defineProperty(obj, '_ob', {
      value: `_ob${++obId}_`,
      enumerable: false, // 不允许枚举
      writable: false, // 不允许修改
      configurable: false // 不允许配置
    });
    return new Proxy(obj, handler);
  }
}
