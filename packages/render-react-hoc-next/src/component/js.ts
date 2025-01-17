/* eslint-disable @typescript-eslint/no-explicit-any */
import { RegisterInput } from "./types";
import { Subject } from "@/utils/rx";
import context from "./context";
import { validateJsMultipleInputs } from "../utils/normal";

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

  const isJsMultipleInputs = componentProps.inputs[0]
    ? validateJsMultipleInputs(componentProps.inputs[0])
    : false;

  const exeOutputs = new Proxy(
    {},
    {
      get(target, key: string) {
        return rels[key] || (rels[key] = new Subject());
      },
    },
  );

  const exe = () => {
    return exeOutputs;
  };

  exe.input = (...args: Array<Subject | unknown>) => {
    if (isJsMultipleInputs) {
      // 多输入模式
      const length = args.length;
      let valueAry: Record<string, unknown> = {};
      args.forEach((value, index) => {
        if ((value as Subject)?.subscribe) {
          (value as Subject).subscribe((value) => {
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
      const value = args[0];
      if ((value as Subject)?.subscribe) {
        (value as Subject).subscribe((value) => {
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

    return exeOutputs;
  };

  return exe;
};

export default hoc;
