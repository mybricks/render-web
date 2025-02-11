import { useMemo, useReducer } from "react";
import { Subject } from "../utils/rx";

type State = {
  state: Record<
    string,
    {
      mounted: boolean;
      visible: boolean;
      type?: "popup" | "normal";
    }
  >;
  status: {
    lastCanvasId?: string;
  };
};

/** 打开类型 */
type OpenType = "blank" | "redirect";

type Action = {
  canvasId: string;
  state: State["state"][string];
  openType?: OpenType;
};

const canvasIO = (canvasId: string, dispatch: React.Dispatch<Action>) => {
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

  const outputs: Record<string, Subject> = {};

  const close = (config: { useDispatch: boolean }) => {
    if (config.useDispatch) {
      dispatch({
        canvasId,
        state: {
          mounted: false,
          visible: false,
        },
      });
    }

    Object.keys(inputs).forEach((key) => {
      Reflect.deleteProperty(inputs, key);
    });
    Object.keys(outputs).forEach((key) => {
      Reflect.deleteProperty(outputs, key);
    });
  };

  return {
    inputs: new Proxy(
      {} as Record<
        string,
        {
          (value: Subject): void;
          subscribe: (fn: (value: unknown) => void) => void;
        }
      >,
      {
        get(_, key: string) {
          if (!inputs[key]) {
            const subject = new Subject();
            subject.next(undefined);
            const next = (value: Subject, openType?: OpenType) => {
              if (value?.subscribe) {
                value.subscribe((value) => {
                  subject.next(value);
                  if (key === "open") {
                    dispatch({
                      canvasId,
                      state: {
                        mounted: true,
                        visible: true,
                      },
                      openType,
                    });
                  }
                });
              } else {
                subject.next(value);
                if (key === "open") {
                  dispatch({
                    canvasId,
                    state: {
                      mounted: true,
                      visible: true,
                    },
                    openType,
                  });
                }
              }

              return new Proxy(
                {},
                {
                  get(_, key: string) {
                    return (outputs[key] = new Subject());
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
    ),
    outputs: new Proxy( // [TODO] 看看是不是写死更好
      {},
      {
        get(_, key: string) {
          return (subject: Subject | unknown) => {
            if (outputs[key]) {
              if ((subject as Subject)?.subscribe) {
                const next = (value: unknown) => {
                  outputs[key]?.next(value);
                  if (key !== "apply") {
                    close({ useDispatch: true });
                    (subject as Subject).unsubscribe(next);
                  }
                };
                (subject as Subject).subscribe(next);
              } else {
                outputs[key]?.next(subject);
                if (key !== "apply") {
                  close({ useDispatch: true });
                }
              }
            } else {
              if (key !== "apply") {
                close({ useDispatch: true });
              }
            }
          };
        },
      },
    ),
    close: (config: { useDispatch: boolean }) => {
      // _env.currentScenes.close()
      close(config);
    },
  };
};

const reducer = (
  state: State,
  {
    action,
    io,
  }: { action: Action; io: Record<string, ReturnType<typeof canvasIO>> },
) => {
  const { canvasId, openType } = action;
  const canvasState = state.state[canvasId];
  const lastCanvasId = state.status.lastCanvasId;

  if (lastCanvasId) {
    if (openType === "blank") {
      // 把上一个隐藏
      return {
        state: {
          ...state.state,
          [lastCanvasId]: {
            visible: false,
            mounted: true,
          },
          [canvasId]: {
            ...canvasState,
            ...action.state,
          },
        },
        status: {
          lastCanvasId: canvasId,
        },
      };
    } else if (openType === "redirect") {
      // 把上一个销毁
      // 销毁io，防止重复注册
      io[lastCanvasId].close({ useDispatch: false });

      return {
        state: {
          ...state.state,
          [lastCanvasId]: {
            visible: false,
            mounted: false,
          },
          [canvasId]: {
            ...canvasState,
            ...action.state,
          },
        },
        status: {
          lastCanvasId: canvasId,
        },
      };
    }
  }

  return {
    state: {
      ...state.state,
      [canvasId]: {
        ...canvasState,
        ...action.state,
      },
    },
    status: state.status, // 没有lastCanvasId并且没有openType，状态不需要发生变更
  };
};

const useCanvasState = (
  defaultValue: Record<
    string,
    {
      mounted: boolean;
      visible: boolean;
      type?: "popup" | "normal";
    }
  >,
) => {
  const [{ state }, dispatch] = useReducer(reducer, null, () => {
    const lastCanvas = Object.entries(defaultValue).find(
      ([, { mounted, visible, type }]) => {
        if (mounted && visible && type !== "popup") {
          return true;
        }
        return false;
      },
    );
    return {
      state: defaultValue,
      status: {
        lastCanvasId: lastCanvas?.[0],
      },
    };
  });

  const io = useMemo(() => {
    return Object.keys(defaultValue).reduce(
      (cur, pre: string) => {
        cur[pre] = canvasIO(pre, (action) => {
          dispatch({
            action,
            io: cur,
          });
        });
        return cur;
      },
      {} as Record<string, ReturnType<typeof canvasIO>>,
    );
  }, []);

  return [
    state as Record<
      string,
      {
        mounted: boolean;
        visible: boolean;
        type?: "popup" | "normal";
      }
    >,
    io,
  ];
};

export default useCanvasState;
