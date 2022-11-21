import React, {
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
import { isObject } from "../utils";
import baseHandlers from "./handles";

const globalKey = "__render-web-createElement__";
let createElement;

/**
 * 劫持 React.createElement 函数
 */
export function hijackReactcreateElement() {
  if (!window[globalKey]) {
    window[globalKey] = true;
    createElement = React.createElement;

    React.createElement = function() {
      let [type, ...other] = arguments;

      if (typeof type === "function" && type.prototype && !(type.prototype instanceof React.Component) && !type.prototype.isReactComponent) {
        if (!type.__rxui__) {
          function Render (props) {
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
              render = type(props);
            });
          
            return render;
          }
  
          type.__rxui__ = Render;
        }

        return createElement(type.__rxui__, ...other);
      } else {
        return createElement(type, ...other);
      }
    };
  }
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