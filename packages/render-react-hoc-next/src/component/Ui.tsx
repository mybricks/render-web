/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  FC,
} from "react";
import { observable } from "@mybricks/render-core";
import { RegisterInput } from "./types";
import { Subject } from "@/utils/rx";
import context from "./context";

interface Props {
  props: {
    data: any;
    style: any;
    children?: any;
    [key: string]: any;
  };
  Component: FC<{
    data: any;
    style: any;
    env: any;
    slots: any;
    inputs: any;
    outputs: any;
  }>;
}

const Hoc = forwardRef((props: Props, ref) => {
  const { props: componentProps, Component } = props;
  const [display, setDisplay] = useState("");

  const { data, style, slots, inputs, outputs, registeredRef, env } =
    useMemo(() => {
      const { data, style, children, ...other } = componentProps;
      const observableData = observable(data);
      const registeredRef: Record<string, (value: Subject<unknown>) => void> = {
        show(value: Subject<unknown>) {
          value.subscribe(() => {
            setDisplay("");
          });
        },
        hide(value: Subject<unknown>) {
          value.subscribe(() => {
            setDisplay("none");
          });
        },
        showOrHide(value: Subject<unknown>) {
          value.subscribe((value) => {
            setDisplay((display) => {
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
        },
      };
      const inputs = new Proxy(
        {},
        {
          get(_, key: string) {
            return (input: RegisterInput) => {
              registeredRef[key] = (value) => {
                const rels: Record<string, Subject<unknown>> = {};

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

      const slots = new Proxy(
        {},
        {
          get(target, key: string) {
            return {
              render: (params: any) => {
                const res = children?.[key]?.(params);
                return res;
              },
            };
          },
        },
      );

      return {
        data: observableData,
        style,
        slots,
        inputs,
        outputs,
        registeredRef,
        env: context.config.env,
      };
    }, []);

  useImperativeHandle(ref, () => {
    return registeredRef;
  }, []);

  return (
    <div style={{ ...style, display }}>
      <Component
        data={data}
        style={style}
        env={env}
        slots={slots}
        inputs={inputs}
        outputs={outputs}
      />
    </div>
  );
});

export default Hoc;
