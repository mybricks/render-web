import React, { useRef, useMemo, forwardRef, useImperativeHandle, createContext, useContext } from "react";

import { createFakePromise } from "../utils";
import { observable } from "../observable";
import { useMyBricksRenderContext, useSceneContext } from "../hooks";
import { uuid } from "@mybricks/render-utils";

interface Params {
  data: any;
  style: any;
  component: any;
  slots?: any;
  events?: any;
}

interface SlotRenderParams {
  /** 唯一键 */
  key?: string;
  /** 输入，key对应输入ID */
  inputValues?: {[key: string]: any};
}

export const UiComponentWrapper = forwardRef((params: Params, ref: any) => {
  const { env, getScene, getComponent } = useMyBricksRenderContext();
  const { _env, scene } = useSceneContext();
  const scope = useScopeSlotContext();
  const {
    data,
    style,
    slots,
    inputs,
    outputs,
    Component,
    registeredInputFunctions,
  } = useMemo(() => {
    const { data, style, component, slots: paramSlots, events } = params;
    const observableData = observable(data);
    const observableStyle = observable(style);
    const registeredInputFunctions: any = {
      show() {
        observableStyle.display = "";
      },
      hide() {
        observableStyle.display = "none";
      },
      showOrHide(bool?: boolean) {
        if (typeof bool === "undefined") {
          if (observableStyle.display === "none") {
            observableStyle.display = "";
          } else {
            observableStyle.display = "none";
          }
        } else {
          observableStyle.display = bool ? "" : "none";
        }
      },
    };
    const inputs = new Proxy(
      {},
      {
        get(_, key) {
          return (func: any) => {
            registeredInputFunctions[key] = func;
          };
        },
      },
    );

    const outputs = new Proxy(
      {},
      {
        get(_, key) {
          return (value: unknown) => {
            return events[key]?.(value, scope);
            // return (events[key] || function () {})(value, scopeId);
          }
        },
      },
    );

    const slots = new Proxy(
      {},
      {
        get(_, key) {
          return {
            render(params: SlotRenderParams = {}) {
              const { type, runtime: Runtime } = paramSlots[key];
              const { key: comKey, ...other } = params;

              if (type === "scope") {
                return (
                  <ScopeSlot key={comKey} runtime={Runtime} parentScope={scope} {...other} />
                )
              }

              return <Runtime key={comKey} {...other}/>;
            },
          };
        },
      },
    );

    return {
      slots,
      inputs,
      outputs,
      Component: getComponent(component),
      data: observableData,
      style: observableStyle,
      registeredInputFunctions
    };
  }, []);

  useImperativeHandle(ref, () => {
    /** 目前组件中都是在useEffect中注册inputs，所以直接使用即可 */
    return {
      setComponent(id: string, events: any) {
        Object.entries(events).forEach(([key, fn]: any) => {
          const inputFunc = registeredInputFunctions[key];
          registeredInputFunctions[key] = fn(inputFunc);
        });

        scene.componentPropsMap[id] = registeredInputFunctions;
      }
    }
  }, []);

  return (
    // 这里style的解构之后优化下
    <div style={{ ...style }}>
      <Component
        slots={slots}
        inputs={inputs}
        outputs={outputs}
        env={env}
        _env={_env}
        data={data}
        style={style}
      />
    </div>
  );
})

/** 作用域插槽 */
function ScopeSlot({ runtime: Runtime, parentScope, ...other }: { runtime: any, parentScope?: ScopeContext }) {
  /** 作用域插槽唯一随机唯一ID */
  // const id = useRef(parentScope ? `${parentScope}_` : "" + uuid(4)).current;
  const id = useRef(uuid(4)).current;

  return (
    <ScopeSlotContext.Provider value={{ scopeId: id, parent: parentScope }}>
      {/* <Runtime scopeId={id} {...other} /> */}
      <Runtime {...other} />
    </ScopeSlotContext.Provider>
  )
}

interface ScopeContext {
  /** 当前作用域插槽ID */
  scopeId: string;
  /** 父节点，用于向上查找ID */
  parent?: ScopeContext;
}

/** 作用域插槽全局上下文 */
const ScopeSlotContext = createContext<ScopeContext>({scopeId: ""});
/** 获取作用域插槽全局上下文 */
function useScopeSlotContext() {
  return useContext(ScopeSlotContext);
}

/** 单输入单输出 并且 输出只有一条连线 */
export function handleSingleOutput(func: any) {
  return (value: any) => {
    return new Promise((resolve) => {
      func(
        value,
        new Proxy(
          {},
          {
            get() {
              return resolve;
            },
          },
        ),
      );
    });
  };
}

/** 单输入多输出 或者 单输入但是单输出有多条连线 */
export function handleMultipleOutputs(func: any) {
  return (value: any) => {
    const promisesCollection = new Proxy<any>(
      {},
      {
        get(target, key) {
          let value = target[key];
          if (!value) {
            value = target[key] = createFakePromise();
          }
          return value;
        },
      },
    );

    const outputs = new Proxy<any>(
      {},
      {
        get(_, key) {
          let value = promisesCollection[key];
          if (!value) {
            value = promisesCollection[key] = createFakePromise();
          }

          return value.resolve;
        },
      },
    );

    func(value, outputs);

    return new Proxy<any>(
      {},
      {
        get(_, key: any) {
          return (...funcs: any) => {
            promisesCollection[key].then((value: any) => {
              funcs.forEach((func: any) => func(value))
            });
          };
        },
      },
    );
  };
}
