/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
  ReactNode,
} from "react";

import { Subject } from "@/utils/rx";

interface Props {
  style: any;
  children: ReactNode;
}

const Module = forwardRef((props: Props, ref) => {
  const [display, setDisplay] = useState("");
  const { style } = props;

  const IO = useMemo(() => {
    const inputs: Record<
      string,
      {
        subject: Subject;
        next: {
          (value: Subject): { [key: string]: Subject };
          subscribe(fn: (value: unknown) => void): void;
        };
      }
    > = {};

    const outputs: Record<
      string,
      {
        subject: Subject;
        next: {
          (value: Subject): void;
          subscribe(fn: (value: unknown) => void): void;
        };
      }
    > = {};

    const inputsProxy = new Proxy(
      {},
      {
        get(_, key: string) {
          if (!inputs[key]) {
            const subject = new Subject();
            const next = (value: Subject | unknown) => {
              if ((value as Subject)?.subscribe) {
                (value as Subject)?.subscribe((value) => {
                  subject.next(value);
                  if (key === "show") {
                    setDisplay("");
                  } else if (key === "hide") {
                    setDisplay("none");
                  } else if (key === "showOrHide") {
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
              } else {
                subject.next(value);
                if (key === "show") {
                  setDisplay("");
                } else if (key === "hide") {
                  setDisplay("none");
                } else if (key === "showOrHide") {
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
              }

              return new Proxy(
                {},
                {
                  get(_, key: string) {
                    if (!outputs[key]) {
                      const subject = new Subject();
                      const next = (value: Subject | unknown) => {
                        if ((value as Subject)?.subscribe) {
                          (value as Subject).subscribe((value) => {
                            subject.next(value);
                          });
                        } else {
                          subject.next(value);
                        }
                      };

                      next.subscribe = (fn: (value: unknown) => void) =>
                        subject.subscribe.call(subject, fn);

                      outputs[key] = {
                        subject,
                        next,
                      };

                      return next;
                    }

                    return outputs[key].next;
                  },
                },
              );
            };

            next.subscribe = (fn: (value: unknown) => void) =>
              subject.subscribe.call(subject, fn);

            inputs[key] = {
              subject,
              next,
            };

            return next;
          }

          return inputs[key].next;
        },
      },
    );

    const outputsProxy = new Proxy(
      {},
      {
        get(_, key: string) {
          if (!outputs[key]) {
            const subject = new Subject();
            const next = (value: Subject | unknown) => {
              if ((value as Subject)?.subscribe) {
                (value as Subject).subscribe((value) => {
                  subject.next(value);
                });
              } else {
                subject.next(value);
              }
            };

            next.subscribe = (fn: (value: unknown) => void) =>
              subject.subscribe.call(subject, fn);

            outputs[key] = {
              subject,
              next,
            };

            return next;
          }

          return outputs[key].next;
        },
      },
    );

    return {
      inputs: inputsProxy,
      outputs: outputsProxy,
    };
  }, []);

  useImperativeHandle(ref, () => {
    return IO;
  }, []);

  return <div style={{ ...style, display }}>{props.children}</div>;
});

export default Module;
