import React, { useMemo, forwardRef,useImperativeHandle } from "react";

import { createPromise } from "../utils";
import { observable } from "../observable";
import { useMyBricksRenderContext, useSceneContext } from "../hooks";

interface Params {
  data: any;
  style: any;
  component: any;
  slots?: any;
  events?: any;
}

export const UiComponentWrapper = forwardRef((params: Params, ref: any) => {
  const { env } = useMyBricksRenderContext();
  const { _env } = useSceneContext();
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
          return events[key] || function () {};
        },
      },
    );

    const slots = new Proxy(
      {},
      {
        get(_, key) {
          return {
            render() {
              const Slot = paramSlots[key];
              return <Slot />;
            },
          };
        },
      },
    );

    return {
      slots,
      inputs,
      outputs,
      Component: component,
      data: observableData,
      style: observableStyle,
      registeredInputFunctions
    };
  }, []);

  useImperativeHandle(ref, () => {
    return registeredInputFunctions;
  });

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
            value = target[key] = createPromise();
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
            value = promisesCollection[key] = createPromise();
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
