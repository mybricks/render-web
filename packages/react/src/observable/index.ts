import React, {
  memo,
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback
} from "react";
import { 
  proxyToRaw,
  rawToProxy,
  globalTaskEmitter,
  globalReactionStack
} from "./global";
import { isObject, pxToRem, pxToVw } from "../../../core/utils";
import baseHandlers from "./handles";

const globalKey = "__render-web-createElement__";
let createElement;

/**
 * 劫持 React.createElement 函数
 */
export function hijackReactcreateElement(props) {
  const { pxToRem: configPxToRem, pxToVw: configPxToVw } = props
  if (!React[globalKey]) {
    React[globalKey] = true;
    createElement = React.createElement;

    React.createElement = function(...args) {
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
        } else if (configPxToVw && style) {
          Object.keys(style).forEach((key) => {
            const value = style[key]
  
            if (typeof value === 'string' && value.indexOf('px') !== -1) {
              style[key] = pxToVw(value)
            }
          })
        }

        if (args.length > 0 && typeof fn === "function") {
          if (!fn.prototype ||
            !(fn.prototype instanceof React.Component) && fn.prototype.isReactComponent === void 0) {
              const enCom = enhanceComponent(fn)
              args.splice(0, 1, enCom)
            }
            return createElement(...args)
        } else if (typeof fn === 'object' && fn.$$typeof === Symbol.for('react.forward_ref')) {
          const enCom = enhanceComponent(fn, true)
          args.splice(0, 1, enCom)

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

function enhanceComponent(fn, isRefCom = false) {
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

function enhance(component, memoIt = true) {
  function hoc (props, refs) {
    const ref = useRef<Reaction | null>(null);
    const [, setState] = useState([]);
  
    useMemo(() => {
      if (!ref.current) {
        ref.current = new Reaction(() => setState([]));
      }
    }, []);
  
    useEffect(() => {
      return () => {
        ref.current?.destroy();
        ref.current = null;
      };
    }, []);
  
    let render;
  
    ref.current?.track(() => {
      render = component(props, refs);
    });
  
    return render;
  }

  hoc.displayName = component.displayName || component.name

  return memoIt ? memo(hoc) : hoc
}

export function observable<T extends object>(obj: T): T {
  if (!isObject(obj)) {
    return {} as any;
  }

  // 是否传入已被observable处理的obj
  if (proxyToRaw.has(obj)) {
    return obj;
  }

  // 是否传入已observable处理过的obj，若否，则创建
  return rawToProxy.get(obj) || createObservable(obj);
}

function createObservable (obj) {
  const handlers = baseHandlers;
  const observable = new Proxy(obj, handlers);

  rawToProxy.set(obj, observable);
  proxyToRaw.set(observable, obj);

  globalTaskEmitter.addTask(obj);

  return observable;
}

class Reaction {
  constructor(private update) {}

  track(fn) {
    globalReactionStack.autoRun(this.update, fn);
  }

  destroy() {
    globalTaskEmitter.deleteReaction(this.update);
  }
}