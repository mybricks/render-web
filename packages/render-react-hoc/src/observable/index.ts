import React, {
  memo,
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  proxyToRaw,
  rawToProxy,
  globalTaskEmitter,
  globalReactionStack,
} from "./global";
import baseHandlers from "./handles";

const globalKey = "__render-web-createElement__";
let createElement: any;

export function isObject(value: any): boolean {
  return value && typeof value === "object";
}

/**
 * 劫持 React.createElement 函数
 */
export function hijackReactcreateElement() {
  if (!(React as any)[globalKey]) {
    (React as any)[globalKey] = true;
    createElement = React.createElement;

    React.createElement = function (...args: any) {
      const [fn, props] = args;
      if (props) {
        if (args.length > 0 && typeof fn === "function") {
          if (
            !fn.prototype ||
            (!(fn.prototype instanceof React.Component) &&
              fn.prototype.isReactComponent === void 0)
          ) {
            const enCom = enhanceComponent(fn);
            args.splice(0, 1, enCom);
          }
          return createElement(...args);
        } else if (
          typeof fn === "object" &&
          fn.$$typeof === Symbol.for("react.forward_ref")
        ) {
          const enCom = enhanceComponent(fn, true);
          args.splice(0, 1, enCom);

          return createElement(...args);
        } else {
          return createElement(...args);
        }
      }

      return createElement(...args);
    };
  }
}

const PROP_ENHANCED = `__enhanced__`;

function enhanceComponent(fn: any, isRefCom = false) {
  let obFn = fn[PROP_ENHANCED];

  if (!obFn) {
    if (isRefCom) {
      obFn = memo(fn);
      obFn.render = enhance(fn.render, false);
    } else {
      obFn = enhance(fn);
    }

    try {
      fn[PROP_ENHANCED] = obFn;
    } catch (ex) {
      console.error(ex);
    }
  }

  const props = Object.getOwnPropertyNames(fn);
  props &&
    props.forEach((prop) => {
      try {
        if (!(isRefCom && prop === "render")) {
          obFn[prop] = fn[prop];
        }
      } catch (ex) {
        console.error(ex);
      }
    });

  return obFn;
}

function enhance(component: any, memoIt = true) {
  function hoc(props: any, refs: any) {
    const ref = useRef<Reaction | null>(null);
    const [, setState] = useState([]);

    const update = useCallback(() => {
      setState([]);
    }, []);

    useMemo(() => {
      if (!ref.current) {
        ref.current = new Reaction(update);
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

  hoc.displayName = component.displayName || component.name;

  return memoIt ? memo(hoc) : hoc;
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

function createObservable(obj: any) {
  const handlers = baseHandlers;
  const observable = new Proxy(obj, handlers);

  rawToProxy.set(obj, observable);
  proxyToRaw.set(observable, obj);

  globalTaskEmitter.addTask(obj);

  return observable;
}

class Reaction {
  constructor(private update: any) {}

  track(fn: any) {
    globalReactionStack.autoRun(this.update, fn);
  }

  destroy() {
    globalTaskEmitter.deleteReaction(this.update);
  }
}
