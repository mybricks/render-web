/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  createContext,
  FC,
  useContext,
  useLayoutEffect,
  useEffect,
} from "react";
import { observable } from "@mybricks/render-core";
import { RegisterInput } from "./types";
import { Subject } from "@/utils/rx";
import context from "./context";

interface Props {
  props: {
    id: string;
    name: string;
    data: any;
    style: any;
    children?: any;
    [key: string]: any;
  };
  Component: FC<{
    id: string;
    name: string;
    data: any;
    style: any;
    env: any;
    slots: any;
    inputs: any;
    outputs: any;
    parentSlot: any;
  }>;
}

const Hoc = forwardRef((props: Props, ref) => {
  const { Component } = props;
  const slotContext = useContext(SlotContext);

  if (slotContext && (slotContext.params.wrap || slotContext.params.itemWrap)) {
    // 不做渲染，被上层代理
    const com = useMemo(() => {
      return getCom(props);
    }, []);

    useImperativeHandle(ref, () => {
      return com.registeredRefProxy;
    });

    let jsx = <JSX {...com} Component={Component} />;

    if (slotContext.params.itemWrap) {
      jsx = slotContext.params.itemWrap({
        id: com.id,
        jsx,
        name: com.name,
        // scope, // [TODO] 作用域？
        // index, // [TODO] 顺序？
      });

      if (slotContext.params.wrap) {
        slotContext.comAry.push({
          id: com.id,
          name: com.name,
          jsx,
          com: {
            id: com.id,
            name: com.name,
          },
          style: com.style,
          inputs: com.inputsCallable,
        });
      }
    }

    return null;
  }

  const com = useMemo(() => {
    return getCom(props);
  }, []);

  useImperativeHandle(ref, () => {
    return com.registeredRefProxy;
  });

  const jsx = <JSX {...com} Component={Component} />;

  return jsx;
});

const getCom = (props: Props) => {
  const { props: componentProps } = props;
  const { id, name, canvasId, data, style, children, ...other } =
    componentProps;
  const observableData = observable(data);
  const registeredInputs: Record<
    string,
    (value: Subject<unknown>, set?: any) => void
  > = {};
  // 用于组件内部调用，用户不感知
  const registeredInputsCallableRef: Record<string, RegisterInput> = {};

  // 触发内部输入时，可能还没有完成输入的注册，记录
  const inputsCallableTodoMap: Record<string, any> = {};

  // 触发外部输入时，可能还没有完成输入的注册，记录
  const inputsTodoMap: Record<string, any> = {};

  const registeredRefProxy = new Proxy(
    {},
    {
      get(_, key: string) {
        return (value: Subject) => {
          const rels: Record<string, Subject<unknown>> = {};

          if (!registeredInputs[key]) {
            // 还没有注册，写入todo，和关联输出
            if (!inputsTodoMap[key]) {
              inputsTodoMap[key] = [];
            }

            inputsTodoMap[key].push({
              value,
              rels,
            });

            return new Proxy(
              {},
              {
                get(target, key: string) {
                  return rels[key] || (rels[key] = new Subject());
                },
              },
            );
          }

          return registeredInputs[key](value, rels);
        };
      },
    },
  );

  const inputs = new Proxy(
    {},
    {
      get(_, key: string) {
        return (input: RegisterInput) => {
          if (inputsCallableTodoMap[key]) {
            inputsCallableTodoMap[key].forEach(({ value, rels }: any) => {
              input(value, rels);
            });
            Reflect.deleteProperty(inputsCallableTodoMap, key);
          }

          registeredInputsCallableRef[key] = input;

          registeredInputs[key] = (
            value,
            rels: Record<string, Subject<unknown>> = {},
          ) => {
            if (value?.subscribe) {
              value.subscribe((value) => {
                input(
                  value,
                  new Proxy(
                    {},
                    {
                      get(target, key: string) {
                        return (value: unknown) => {
                          (rels[key] || (rels[key] = new Subject())).next(
                            value,
                          );
                        };
                      },
                    },
                  ),
                );
              });
            } else {
              input(
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

            return new Proxy(
              {},
              {
                get(target, key: string) {
                  return rels[key] || (rels[key] = new Subject());
                },
              },
            );
          };

          if (inputsTodoMap[key]) {
            inputsTodoMap[key].forEach(({ value, rels }: any) => {
              registeredInputs[key](value, rels);
            });
            Reflect.deleteProperty(inputsTodoMap, key);
          }
        };
      },
    },
  );

  const outputs = new Proxy(
    {},
    {
      get(target, key: string) {
        const output = (value: unknown) => {
          const nextValue = new Subject();
          nextValue.next(value);
          other[key]?.(nextValue);
        };

        output.getConnections = () => {
          return 1;
        };

        return output;
      },
    },
  );

  const slotsProps: Record<
    string,
    {
      _inputs: Record<string, (value: any) => void>;
      inputs: Record<string, (value: any) => void>;
      inputsSubject: Record<string, Subject>;
    }
  > = {};

  const slots = new Proxy(
    {},
    {
      get(target, slotId: string) {
        let slot = slotsProps[slotId];

        if (!slot) {
          const inputsSubject: Record<string, Subject> = {};
          slot = slotsProps[slotId] = {
            _inputs: {},
            inputs: new Proxy(
              {},
              {
                get(_, key: string) {
                  if (!inputsSubject[key]) {
                    inputsSubject[key] = new Subject();
                  }

                  return inputsSubject[key];
                },
              },
            ),
            inputsSubject,
          };
        }

        return {
          render: (params: any) => {
            let child = null;

            if (children) {
              if (Array.isArray(children)) {
                child = children.find((child) => child.props.id === slotId);
              } else if (children.props.id === slotId) {
                child = children;
              }
            }

            if (child) {
              return (
                <SlotProvider
                  {...child.props}
                  slot={slotsProps[slotId]}
                  params={params}
                />
              );
            }

            return child;
          },
          _inputs: new Proxy(
            {},
            {
              get(_, key: string) {
                return (handle: (value: any) => void) => {
                  // 内部调用，不需要做处理
                  slot._inputs[key] = handle;
                };
              },
            },
          ),
          inputs: new Proxy(
            {},
            {
              get(_, key: string) {
                return (value: any) => {
                  // 内部调用，一定是普通值
                  if (slot.inputsSubject[key]) {
                    slot.inputsSubject[key].next(value);
                  } else {
                    slot.inputsSubject[key] = new Subject();
                    slot.inputsSubject[key].next(value);
                  }
                };
              },
            },
          ),
        };
      },
    },
  );

  const inputsCallable = new Proxy(
    {},
    {
      get(_, inputId: string) {
        return (value: any) => {
          return new Proxy(
            {},
            {
              get(_, outputId: string) {
                return (output: any) => {
                  if (!registeredInputsCallableRef[inputId]) {
                    if (!inputsCallableTodoMap[inputId]) {
                      inputsCallableTodoMap[inputId] = [];
                    }

                    inputsCallableTodoMap[inputId].push({
                      value,
                      rels: {
                        [outputId]: output, // 关联输出只有一个
                      },
                    });
                  } else {
                    registeredInputsCallableRef[inputId](value, {
                      [outputId]: output, // 关联输出只有一个
                    });
                  }
                };
              },
            },
          );
        };
      },
    },
  );

  return {
    id,
    name,
    canvasId,
    data: observableData,
    style,
    slots,
    inputs,
    outputs,
    registeredInputs,
    env: context.config.env,
    _env: {
      currentScenes: {
        close: () => {
          context.config.canvasIO[canvasId].close();
        },
      },
    },
    registeredInputsCallableRef,
    inputsCallableTodoMap,
    inputsCallable,
    registeredRefProxy,
  };
};

const JSX = (props: any) => {
  const slotContext = useContext(SlotContext);
  const [display, setDisplay] = useState("");
  const {
    id,
    name,
    data,
    style,
    slots,
    inputs,
    outputs,
    env,
    _env,
    Component,
  } = props;

  useMemo(() => {
    inputs["show"]((value: Subject) => {
      if (value?.subscribe) {
        value.subscribe(() => {
          setDisplay("");
        });
      } else {
        setDisplay("");
      }
    });

    inputs["hide"]((value: Subject) => {
      if (value?.subscribe) {
        value.subscribe(() => {
          setDisplay("none");
        });
      } else {
        setDisplay("none");
      }
    });

    inputs["showOrHide"]((value: Subject<unknown>) => {
      if (value?.subscribe) {
        value.subscribe((value) => {
          setDisplay((display: any) => {
            if (typeof value === "undefined") {
              if (display === "none") {
                return "";
              } else {
                return "none";
              }
            } else {
              return value ? "" : "none";
            }
          });
        });
      } else {
        setDisplay((display: any) => {
          if (typeof value === "undefined") {
            if (display === "none") {
              return "";
            } else {
              return "none";
            }
          } else {
            return value ? "" : "none";
          }
        });
      }
    });
  }, []);

  return (
    <div style={{ ...style, display }}>
      <Component
        id={id}
        name={name}
        data={data}
        style={style}
        env={env}
        _env={_env}
        slots={slots}
        inputs={inputs}
        outputs={outputs}
        parentSlot={{
          _inputs: new Proxy(
            {},
            {
              get(_, key) {
                return slotContext.slot._inputs[key];
              },
            },
          ),
        }}
      />
    </div>
  );
};

export default Hoc;

interface SlotProps {
  id: string;
  style: any;
  params: any;
  slot: any;
  children: any;
}

const SlotContext = createContext<any>(null);

const SlotProvider = (props: SlotProps) => {
  const slotProviderValue = useMemo(() => {
    let slot = props.slot;
    let hasInputValues = false;
    if (props.params?.inputValues) {
      hasInputValues = true;

      const inputsSubject: Record<string, Subject> = {};
      slot = {
        _inputs: {},
        inputs: new Proxy(
          {},
          {
            get(_, key: string) {
              if (!inputsSubject[key]) {
                inputsSubject[key] = new Subject();
              }

              return inputsSubject[key];
            },
          },
        ),
        inputsSubject,
      };
    }

    return {
      slot,
      params: props.params,
      comAry: [],
      hasInputValues,
    };
  }, []);

  if (slotProviderValue.hasInputValues) {
    useEffect(() => {
      if (props.params.inputValues) {
        Object.entries(props.params.inputValues).forEach(([id, value]) => {
          slotProviderValue.slot.inputs[id].next(value);
        });
      }
    }, [props.params.inputValues]);
  }

  return (
    <SlotContext.Provider value={slotProviderValue}>
      <Slot {...props} />
    </SlotContext.Provider>
  );
};

const Slot = (props: SlotProps) => {
  const Children = props.children;
  const { slot, params, comAry } = useContext(SlotContext);
  const [jsx, setJsx] = useState(<Children slot={slot.inputs} />);

  useLayoutEffect(() => {
    if (params?.wrap) {
      setJsx(params.wrap(comAry));
    }
  }, []);

  return jsx;
};
