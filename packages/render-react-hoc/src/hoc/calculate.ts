import { _ } from "../";
import { createPromise } from "../utils";

interface Params {
  data: any;
  component: any;
}

/** 单输入单输出 并且 输出只有一条连线 */
export function jsComponentSingleOutputWrapper(
  { data, component }: Params,
  { env }: any,
) {
  return (value: any) => {
    return new Promise((resolve) => {
      const outputs = new Proxy<any>(
        {},
        {
          get() {
            return resolve;
          },
        },
      );
      component({
        env,
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

/** 单输入多输出 或者 单输入但是单输出有多条连线 */
export function jsComponentMultipleOutputsWrapper(
  { data, component }: Params,
  { env }: any,
) {
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
          return promisesCollection[key].resolve;
        },
      },
    );

    component({
      env,
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
          return (func: any) => {
            promisesCollection[key].then((value: any) => {
              func(value);
            });
          };
        },
      },
    );
  };
}

/** 多输入单输出 并且 输出只有一条连线 */
export function jsComponentMultipleInputsWrapper(
  { data, component }: Params,
  { env }: any,
) {
  /** 最终输入的数据 */
  let inputValues: undefined | Array<any>;

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

        component({
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
