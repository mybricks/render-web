import { useMemo, useReducer } from "react";
import { Subject } from "../utils/rx";

type State = Record<
  string,
  {
    mounted: boolean;
    visible: boolean;
    type?: "popup";
  }
>;

type Action = {
  canvasId: string;
  state: State[string];
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

  const close = () => {
    dispatch({
      canvasId,
      state: {
        mounted: false,
        visible: false,
      },
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
            const next = (value: Subject) => {
              if (value?.subscribe) {
                value.subscribe((value) => {
                  subject.next(value);
                });
              } else {
                subject.next(value);
              }

              if (key === "open") {
                dispatch({
                  canvasId,
                  state: {
                    mounted: true,
                    visible: true,
                  },
                });
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
                    close();
                    (subject as Subject).unsubscribe(next);
                  }
                };
                (subject as Subject).subscribe(next);
              } else {
                outputs[key]?.next(subject);
                if (key !== "apply") {
                  close();
                }
              }
            } else {
              if (key !== "apply") {
                close();
              }
            }
          };
        },
      },
    ),
    close: () => {
      // _env.currentScenes.close()
      close();
    },
  };
};

const reducer = (state: State, action: Action) => {
  const canvasState = state[action.canvasId];

  return {
    ...state,
    [action.canvasId]: {
      ...canvasState,
      ...action.state,
    },
  };
};

const useCanvasState = (
  defaultValue: Record<
    string,
    {
      mounted: boolean;
      visible: boolean;
      type?: "popup";
    }
  >,
) => {
  const [state, dispatch] = useReducer(reducer, null, () => {
    return defaultValue;
  });

  const io = useMemo(() => {
    return Object.keys(defaultValue).reduce(
      (cur, pre: string) => {
        cur[pre] = canvasIO(pre, dispatch);
        return cur;
      },
      {} as Record<string, ReturnType<typeof canvasIO>>,
    );
  }, []);

  return [state, io];
};

export default useCanvasState;
