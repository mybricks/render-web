import { _ } from "../";
import { createPromise, createFakePromise } from "../utils";

import type { MyBricks } from "../";

interface Params {
  /** 组件数据源 */
  data: any;
  /** 组件namespace */
  component: string;
}

/** 单输入单输出 */
export function jsComponentSingleOutputWrapper(
  this: MyBricks,
  { data, component }: Params,
) {
  return (value: any) => {
    return new Promise((resolve) => {
      const { globalContext } = this;
      const outputs = new Proxy<any>(
        {},
        {
          get() {
            return resolve;
          },
        },
      );
      const fn = globalContext.getComponent(component);
      fn({
        env: globalContext.env,
        data,
        inputs: new Proxy<any>(
          {},
          {
            get() {
              return (func: any) => {
                func(value, outputs);
              };
            },
          },
        ),
        outputs,
      });
    });
  };
}

/** 单输入多输出 */
export function jsComponentMultipleOutputsWrapper(
  this: MyBricks,
  { data, component }: Params,
) {
  return (value: any) => {
    const { globalContext } = this;
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
          return promisesCollection[key].resolve;
        },
      },
    );
    const fn = globalContext.getComponent(component);

    fn({
      env: globalContext.env,
      data,
      inputs: new Proxy<any>(
        {},
        {
          get() {
            return (func: any) => {
              func(value, outputs);
            };
          },
        },
      ),
      outputs,
    });

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

/** 多输入 - 多输出（单输出也做多输出处理） */
export function jsComponentMultipleInputsWrapper(
  this: MyBricks,
  { data, component }: Params,
) {
  /** 最终输入的数据 */
  let inputValues: undefined | Array<any>;
  let fn: any;
  let env: any;

  return (outputs: any) => {
    return (value: Array<any>) => {
      if (!inputValues) {
        inputValues = value;
      } else {
        value.forEach((val: any, index: number) => {
          if (val !== _) {
            inputValues![index] = val;
          } else if (!(index in inputValues!)) {
            inputValues![index] = val;
          }
        });
      }

      if (!inputValues!.find((value) => value === _)) {
        const value = inputValues!.reduce((p, c, index) => {
          return {
            ...p,
            [`input${index}`]: c,
          };
        }, {});
        const inputs = new Proxy<any>(
          {},
          {
            ownKeys() {
              return inputValues!.map((_, index) => `input${index}`);
            },
            getOwnPropertyDescriptor() {
              return {
                enumerable: true,
                configurable: true,
              };
            },
            get() {
              return (func: any) => {
                func(value, outputs);
              };
            },
          },
        );

        if (!fn || !env) {
          const { globalContext } = this;
          fn = globalContext.getComponent(component);
          env = globalContext.env;
        }

        fn({
          env,
          data,
          inputs,
          outputs,
        });

        inputValues = undefined;
      }
    };
  };
}

/** fx卡片的包装 - 多输出（单输出也做多输出处理） */
export function fxWrapper<T extends (...args: any[]) => any>(fn: T) {
  return (...params: Parameters<T>) => {
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

    fn.bind(
      new Proxy(<any>{}, {
        get(_, key: any) {
          return promisesCollection[key].resolve;
        },
      }),
    )(...params);

    return new Proxy<any>(
      {},
      {
        get(_, key: any) {
          return (...funcs: any) => {
            promisesCollection[key].then((value: any) => {
              funcs.forEach((func: any) => func(value));
            });
          };
        },
      },
    );
  };
}
