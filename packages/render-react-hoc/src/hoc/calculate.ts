import { _ } from "../";
import { createFakePromise } from "../utils";

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
  /** 全局上下文 */
  const that = this;
  /** 最终输入的数据 */
  let inputValues: undefined | Array<any>;
  let fn: any;
  let env: any;

  return (outputs: any) => {
    return function (this: any, value: Array<any>) {
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
        /** fx 卡片全局上下文 */
        const frameThat = this;
        const proxyOutputs = new Proxy<any>(
          {},
          {
            ownKeys() {
              return Object.keys(outputs);
            },
            getOwnPropertyDescriptor() {
              return {
                enumerable: true,
                configurable: true,
              };
            },
            get(_, key) {
              return outputs[key].bind(frameThat)
            }
          }
        )
        /** 组装多输入最终输入的值 */
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
                func(value, proxyOutputs);
              };
            },
          },
        );

        if (!fn || !env) {
          const { globalContext } = that;
          fn = globalContext.getComponent(component);
          env = globalContext.env;
        }

        fn({
          env,
          data,
          inputs,
          outputs: proxyOutputs,
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

/** 场景状态包装器 */
export function sceneContextWrapper(this: any, sceneId: string) {
  let scene;
  /** 场景打开输入的值 */
  let openData: unknown;
  /** 获取场景 */
  const getScene = () => {
    return scene ||= this.globalContext.getScene(sceneId);
  }
  /** 打开场景 */
  const openScene = () => {
    // this.globalContext.openScene(sceneId)
    getScene().open();
  };
  /** 关闭场景 */
  const closeScene = () => {
    // this.globalContext.closeScene(sceneId);
    getScene().close();
    openData = void 0;
  };
  const promisesCollection = new Proxy<any>(
    {},
    {
      get(target, key) {
        let value = target[key];
        if (!value) {
          value = target[key] = createFakePromise();
          const r = value.resolve
          value.resolve = (value: unknown) => {
            if (key !== "apply") {
              /** 非“应用”输出，默认关闭场景 */
              closeScene();
            }
            r(value)
          }
        }
        return value;
      },
    },
  );

  const bindProxy = new Proxy<any>(
    {},
    {
      get(_, key: any) {
        return promisesCollection[key].resolve;
      },
    }
  )

  return {
    /** 场景初始化 */
    init(func: any) {
      this.wrapper(func)(openData);
    },
    /** 打开场景 */
    open(value: unknown) {
      /** 设置输入值 */
      openData = value;
      /** 打开场景 */
      openScene();

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
    },
    /** 事件包装器 */
    wrapper(func: any) {
      return (value: unknown) => {
        func.bind(bindProxy)(value);
      }
    },
    /** 写入组件信息，当前仅组件的输入 */
    setComponent(id: string, componentProps: {[key: string]: (value?: unknown) => any;}) {
      // console.log(id, "注册的组件 id")
      // console.log(getScene(), "getScene() 获取当前场景信息")
      getScene().componentPropsMap[id] = componentProps;
    },
    /** 获取组件信息，当前仅组件的输入 */
    getComponent(id: string) {
      return getScene().componentPropsMap[id];
    }
  };
}
