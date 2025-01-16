/* eslint-disable @typescript-eslint/no-explicit-any */
import { RegisterInput } from "./types";
import { Subject } from "@/utils/rx";
import context from "./context";
import { Empty } from "./constants";

interface Props {
  props: {
    data: any;
    style: any;
    children?: any;
    [key: string]: any;
  };
  component: (value: {
    data: any;
    env: any;
    inputs: any;
    outputs: any;
  }) => void;
}

const hoc = (props: Props) => {
  const { props: componentProps, component } = props;

  // 只会有一个输入
  let valueInput: RegisterInput;
  const inputs = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        return {
          enumerable: true,
          configurable: true,
        };
      },
      ownKeys() {
        return componentProps.inputs;
      },
      get() {
        return (input: RegisterInput) => {
          valueInput = input;
        };
      },
    },
  );
  const rels: Record<string, Subject<unknown>> = {};
  const outputs = new Proxy(
    {},
    {
      ownKeys() {
        return componentProps.outputs;
      },
      getOwnPropertyDescriptor() {
        return {
          enumerable: true,
          configurable: true,
        };
      },
      get(target, key: string) {
        return (value: unknown) => {
          (rels[key] || (rels[key] = new Subject())).next(value);
        };
      },
    },
  );

  component({
    env: context.config.env,
    data: componentProps.data,
    inputs,
    outputs,
  });

  return (
    value: Subject<unknown> | Subject<unknown>[] | typeof Empty = Empty,
  ) => {
    if (Array.isArray(value)) {
      const length = value.length;
      let valueAry: Record<string, unknown> = {};
      value.forEach((value, index) => {
        if (value?.subscribe) {
          value.subscribe((value) => {
            valueAry[componentProps.inputs[index]] = value;
            if (Object.keys(valueAry).length === length) {
              valueInput(
                valueAry,
                new Proxy(
                  {},
                  {
                    get(target, key: string) {
                      return (value: unknown) => {
                        (rels[key] || (rels[key] = new Subject())).next(value);
                      };
                    },
                  },
                ),
              );
              valueAry = {};
            }
          });
        } else {
          valueAry[componentProps.inputs[index]] = value;
          if (Object.keys(valueAry).length === length) {
            valueInput(
              valueAry,
              new Proxy(
                {},
                {
                  get(target, key: string) {
                    return (value: unknown) => {
                      (rels[key] || (rels[key] = new Subject())).next(value);
                    };
                  },
                },
              ),
            );
            valueAry = {};
          }
        }
      });
    } else {
      if (value !== Empty) {
        if (value?.subscribe) {
          value.subscribe((value) => {
            valueInput(
              value,
              new Proxy(
                {},
                {
                  get(target, key: string) {
                    return (value: unknown) => {
                      (rels[key] || (rels[key] = new Subject())).next(value);
                    };
                  },
                },
              ),
            );
          });
        } else {
          valueInput(
            value,
            new Proxy(
              {},
              {
                get(target, key: string) {
                  return (value: unknown) => {
                    (rels[key] || (rels[key] = new Subject())).next(value);
                  };
                },
              },
            ),
          );
        }
      }
    }

    return new Proxy(
      {},
      {
        get(target, key: string) {
          return rels[key] || (rels[key] = new Subject());
        },
      },
    );
  };
};

export default hoc;
