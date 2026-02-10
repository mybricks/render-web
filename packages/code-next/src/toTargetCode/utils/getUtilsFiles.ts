const UTILS_DIR = "utils";

const CONSTANT_FILE = {
  path: `${UTILS_DIR}/constant.js`,
  content: `export const SUBJECT_NEXT = Symbol("SUBJECT_NEXT")
export const SUBJECT_VALUE = Symbol("SUBJECT_VALUE")
export const SUBJECT_SUBSCRIBE = Symbol("SUBJECT_SUBSCRIBE")
export const SUBJECT_UNSUBSCRIBE = Symbol("SUBJECT_UNSUBSCRIBE")
export const SUBJECT_EMPTY = Symbol("SUBJECT_EMPTY")
export const SUBJECT_SETVALUE = Symbol("SUBJECT_SETVALUE")
export const EXE_TITLE_MAP = {
  output: "输出",
  input: "输入"
}
`,
};

const CREATEJSHANDLE_FILE = {
  path: `${UTILS_DIR}/createJSHandle.js`,
  content: `import { EXE_TITLE_MAP, SUBJECT_NEXT, SUBJECT_SUBSCRIBE } from "./constant"
import { Subject } from "./Subject"
import { log, logger } from "./log"
import { createReactiveInputHandler } from "./createReactiveInputHandler"

/** utils */
/**
 * 判断是否js多输入
 */
export const validateJsMultipleInputs = (input) => {
  return input.match(/\\./); // input.xxx 为多输入模式
}

// JS
export const createJSHandle = (fn, options) => {
  fn = _execJs(fn);
  let controller

  const { props, appContext } = options

  const inputs = new Proxy({}, {
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
    ownKeys() {
      return props.inputs
    },
    get() {
      return (input) => {
        // 约定只有一个输入
        controller = input
      }
    }
  })

  const rels = {}

  const outputs = new Proxy({}, {
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
    ownKeys() {
      return props.outputs
    },
    get(_, key) {
      return (value) => {
        (rels[key] ||
          (rels[key] = new Subject({ log: \`\${EXE_TITLE_MAP["output"]} \${props.title} | \${key}\` })))[SUBJECT_NEXT](value)
      }
    }
  })

  fn({
    data: props.data,
    inputs,
    outputs,
    logger,
    env: appContext?.env
  })

  const isJsMultipleInputs = props.inputs[0]
    ? validateJsMultipleInputs(props.inputs[0])
    : false;

  const exeOutputs = new Proxy(
    {},
    {
      get(_, key) {
        return rels[key] || (rels[key] = new Subject({ log: \`\${EXE_TITLE_MAP["output"]} \${props.title} | \${key}\` }))
      },
    },
  )

  const exe = (...args) => {
    if (args.length) {
      // 调用输入
      if (isJsMultipleInputs) {
        // 多输入模式
        const length = args.length;
        let valueAry = {};
        args.forEach((value, index) => {
          if (value?.[SUBJECT_SUBSCRIBE]) {
            value[SUBJECT_SUBSCRIBE]((value) => {
              log(\`\${EXE_TITLE_MAP["input"]} \${props.title} | \${props.inputs[index]}\`, JSON.stringify(value));
              valueAry[props.inputs[index]] = value
              if (Object.keys(valueAry).length === length) {
                createReactiveInputHandler({
                  input: controller,
                  value: valueAry,
                  rels,
                  title: props.title
                })
                // 触发输入后清除
                valueAry = {}
              }
            })
          } else {
            log(\`\${EXE_TITLE_MAP["input"]} \${props.title} | \${props.inputs[index]}\`, JSON.stringify(value));
            valueAry[props.inputs[index]] = value

            if (Object.keys(valueAry).length === length) {
              createReactiveInputHandler({
                input: controller,
                value: valueAry,
                rels,
                title: props.title
              })
              // 触发输入后清除
              valueAry = {}
            }
          }
        })
      } else {
        // 非多输入
        const value = args[0]
        if (value?.[SUBJECT_SUBSCRIBE]) {
          value[SUBJECT_SUBSCRIBE]((value) => {
            log(\`\${EXE_TITLE_MAP["input"]} \${props.title} | \${props.inputs[0]}\`, JSON.stringify(value));
            createReactiveInputHandler({
              input: controller,
              value,
              rels,
              title: props.title
            })
          })
        } else {
          log(\`\${EXE_TITLE_MAP["input"]} \${props.title} | \${props.inputs[0]}\`, JSON.stringify(value));
          createReactiveInputHandler({
            input: controller,
            value,
            rels,
            title: props.title
          })
        }
      }
    }

    return exeOutputs;
  }

  return exe;
}

function convertObject2Array(input) {
  let result = [];
  Object.keys(input)
    .sort((a, b) => {
      let _a = extractNumbers(a) || 0;
      let _b = extractNumbers(b) || 0;
      return +_a - +_b;
    })
    .forEach((key) => {
      result.push(input[key]);
    });
  return result;
}
function extractNumbers(str) {
  let number = "";
  for (let i = 0; i < str.length; i++) {
    if (!isNaN(parseInt(str[i]))) {
      number += str[i];
    }
  }
  return number;
}
function _execJs (script) {
  return function ({ env, data, inputs, outputs, logger, onError }) {
    const { fns, runImmediate } = data;
    const runJSParams = {
      logger,
      outputs: convertObject2Array(outputs)
    };
    try {
      if (runImmediate) {
        script(runJSParams);
      }
      inputs['input']((val) => {
        try {
          script({
            ...runJSParams,
            inputs: convertObject2Array(val)
          });
        } catch (ex) {
          console.error('js计算组件运行错误.', ex);
        }
      });
    } catch (ex) {
      console.error('js计算组件运行错误.', ex);
    }
  }
}`,
};

const CREATEREACTIVEINPUTHANDLER_FILE = {
  path: `${UTILS_DIR}/createReactiveInputHandler.js`,
  content: `import { EXE_TITLE_MAP, SUBJECT_NEXT, SUBJECT_SUBSCRIBE } from "./constant"
import { Subject } from "./Subject"

/** 组件的输入 */
export const createReactiveInputHandler = (params) => {
  const { input, value, rels, title } = params;
  if (value?.[SUBJECT_SUBSCRIBE]) {
    value[SUBJECT_SUBSCRIBE]((value) => {
      input(value, new Proxy({}, {
        get(_, key) {
          return (value) => {
            (rels[key] ||
              (rels[key] = new Subject({ log: \`\${EXE_TITLE_MAP["output"]} \${title} | \${key}\` })))[SUBJECT_NEXT](value)
          }
        }
      }))
    })
  } else {
    input(value, new Proxy({},
      {
        get(_, key) {
          return (value) => {
            (rels[key] ||
              (rels[key] = new Subject({ log: \`\${EXE_TITLE_MAP["output"]} \${title} | \${key}\` })))[SUBJECT_NEXT](value)
          }
        }
      }
    ))
  }

  return new Proxy({},
    {
      get(_, key) {
        return rels[key] || (rels[key] = new Subject({ log: \`\${EXE_TITLE_MAP["output"]} \${title} | \${key}\` }))
      }
    }
  )
}`,
};

const HOOKS_FILE = {
  path: `${UTILS_DIR}/hooks.js`,
  content: `import { useImperativeHandle } from "react";
import { SUBJECT_SUBSCRIBE } from "../utils/constant";

export const useSubjectImperativeHandle = (ref) => {
  useImperativeHandle(ref, () => {
    const oriRef = {}

    Object.entries(ref?.current || {}).forEach(([key, fn]) => {
      oriRef[key] = fn;
    });

    return new Proxy({}, {
      get(_, key) {
        return (value) => {
          if (value?.[SUBJECT_SUBSCRIBE]) {
            value?.[SUBJECT_SUBSCRIBE]((value) => {
              oriRef?.[key]?.(value)
            });
          } else {
            oriRef?.[key]?.(value)
          }
        }
      }
    })
  }, [])
}`,
};

const INDEX_FILE = {
  path: `${UTILS_DIR}/index.js`,
  content: `export * from "./createJSHandle"
export { default as wrap } from "./wrap"
`,
};

const LOG_FILE = {
  path: `${UTILS_DIR}/log.js`,
  content: `export const log = (...args) => {
  console.log("[MyBricks]", ...args)
}

export const logger = {
  info: log,
  warn: log,
  error: log,
}
`,
};

const SUBJECT_FILE = {
  path: `${UTILS_DIR}/Subject.js`,
  content: `import { log } from "./log"
import {
  SUBJECT_NEXT,
  SUBJECT_VALUE,
  SUBJECT_EMPTY,
  SUBJECT_SETVALUE,
  SUBJECT_SUBSCRIBE,
  SUBJECT_UNSUBSCRIBE
} from "./constant"

/** 数据流 */
export class Subject {
  _values = []
  _observers = new Set()
  _log = undefined
  _empty = true;

  constructor(params = {}) {
    this._log = params.log
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }

        const subjectNext = new SubjectNext(prop)

        target[SUBJECT_SUBSCRIBE]((value, extra) => {
          subjectNext[SUBJECT_NEXT](value, extra)
        })

        return subjectNext
      }
    })
  }

  get [SUBJECT_VALUE]() {
    return this._values[0]
  }

  get [SUBJECT_EMPTY]() {
    return this._empty;
  }

  [SUBJECT_SETVALUE](value) {
    this._values[0] = value;
    this._empty = false;
  }

  [SUBJECT_NEXT](value, extra) {
    log(this._log, JSON.stringify(value))
    this._values[0] = value
    this._empty = false
    this._observers.forEach((observer) => observer(value, extra))
  }

  [SUBJECT_SUBSCRIBE](observer) {
    if (this._values.length) {
      observer(this._values[0])
    }
    this._observers.add(observer)
  }

  [SUBJECT_UNSUBSCRIBE](observer) {
    this._observers.delete(observer)
  }
}

function getValueNextByPath(params) {
  const { value, path } = params
  let current = value
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[key]
  }
  return current
}

class SubjectNext extends Subject {
  _path = []

  constructor(path) {
    super()

    this._path.push(path)

    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }

        target._path.push(prop)

        return target;
      }
    })
  }

  [SUBJECT_NEXT](value, extra) {
    this._values[0] = value
    this._empty = false
    const nextValue = getValueNextByPath({ value, path: this._path })
    this._observers.forEach((observer) => observer(nextValue, extra))
  }

  [SUBJECT_SUBSCRIBE](observer) {
    if (this._values.length) {
      observer(getValueNextByPath({ value: this._values[0], path: this._path }))
    }
    this._observers.add(observer)
  }
}
`,
};

const WRAP_FILE = {
  path: `${UTILS_DIR}/wrap.jsx`,
  content: `import React, { forwardRef } from "react";
import { useSubjectImperativeHandle } from "./hooks"

export default function wrap(Compnent) {
  return forwardRef(function (props, ref) {
    const { style, Component, ...rest} = props;
    useSubjectImperativeHandle(ref);
    return (
      <div style={style}>
        <Compnent ref={ref} {...rest}/>
      </div>
   );
  })
}`,
};

export function getUtilsFiles() {
  return [
    CONSTANT_FILE,
    CREATEJSHANDLE_FILE,
    CREATEREACTIVEINPUTHANDLER_FILE,
    HOOKS_FILE,
    INDEX_FILE,
    LOG_FILE,
    SUBJECT_FILE,
    WRAP_FILE,
  ];
}
