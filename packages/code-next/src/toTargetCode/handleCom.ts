/* eslint-disable @typescript-eslint/no-explicit-any */
import { TARGET_TYPE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleSlot from "./handleSlot";
import { convertCamelToHyphen, toSafeFileName, ImportManager } from "./utils";

export type Com = Extract<UI["children"][0], { type: "com" }>;

const handleCom = (com: Com, config: BaseConfig) => {
  // 1. 优先处理 AI 组件
  const aiResult = handleAICom(com, config);
  if (aiResult) {
    return aiResult;
  }

  const comDef = config.getComDef(com.meta.def);

  const { css, style } = extractStyleAndCSS(com);
  let childCssCode = "";
  const targetResult = comDef?.target?.[TARGET_TYPE[config.target]]?.({
    id: com.props.id,
    data: com.props.data,
    style,
    slots: new Proxy(
      {},
      {
        get(_, slotId: string) {
          return {
            render() {
              const slot = com.slots?.[slotId];
              if (slot) {
                const { css, jsx } = handleSlot(slot, config);
                childCssCode += css;
                return `{/** ${slot.meta.title} - ${slot.meta.slotId} */}${jsx}`;
              }
              return "";
            },
          };
        },
      },
    ),
  });

  config.setComTarget(com.meta.id, targetResult);

  targetResult?.imports?.forEach((importItem: any) => {
    const { from, coms } = importItem;
    config.importManager.addImport({
      packageName: from,
      dependencyNames: coms,
      importType: "named",
    });
  });

  // const divTag = TAG_TRANSLATE[config.target].div;

  return {
    jsx: targetResult?.jsx
      ? `{/* ${com.meta.title} - ${com.meta.id} */}${targetResult?.jsx}`
      : "",
    css: css + childCssCode,
  };

  // return {
  //   jsx: `{/* ${com.meta.title} - ${com.meta.id} */}<${divTag} className="${com.props.id}" style={${JSON.stringify(style)}}>${targetResult?.jsx}</${divTag}>`,
  //   css: css + childCssCode,
  // };
};

const handleAICom = (com: Com, config: BaseConfig) => {
  if (com.meta.def.namespace !== "mybricks.basic-comlib.ai-mix") return null;

  const comDef = config.getComDef(com.meta.def);
  const targetFn = comDef?.target?.[TARGET_TYPE[config.target]];

  if (!targetFn) return null;

  const { css, style } = extractStyleAndCSS(com);

  config.refs.set(com.props.id, false);

  // 假设 target 函数返回 { jsx, componentName, files: [] }
  const res = targetFn({
    title: com.meta.title,
    id: com.props.id,
    data: com.props.data,
    style,
    slots: com.slots, // 传递 slots 以防万一
    events: new Proxy(
      {},
      {
        get(_, key: string) {
          let eventCode = "";
          const diagramId = com.events?.[key]?.diagramId;
          if (diagramId) {
            const event = config.getEventByDiagramId(diagramId)!;
            if (event) {
              eventCode = handleProcess(event, {
                ...config,
                addParentDependencyImport: config.importManager.addImport,
                getParams: () => ({ [key]: "value" }),
              });
              if (eventCode.length) {
                config.useIO();
              }
            }
          }
          return `${key}={(value) => {
            ${eventCode}
          }}`;
        },
      },
    ),
  });

  if (!res) return null;

  // 1. 收集文件
  if (res.files && Array.isArray(res.files)) {
    config.addComponentFile(res.componentName, res.files);
  }

  // 2. 添加引用（相对于当前页面的 index.tsx，路径与 toTargetCode 中目录名一致）
  if (res.componentName) {
    const safeName = toSafeFileName(res.componentName);
    config.importManager.addImport({
      packageName: `./components`,
      dependencyNames: [safeName],
      importType: "named",
    });
  }

  // 3. 返回结果
  return {
    jsx: res.jsx ? `{/* ${com.meta.title} */}${res.jsx}` : "",
    css: css, // 只返回布局样式
  };
};

export default handleCom;

const extractStyleAndCSS = (com: any) => {
  const style = com.props.style;
  const comId = com.props.id;

  const { styleAry, inSmartLayout, ...other } = style;
  const cleanStyle = { ...other };
  Reflect.deleteProperty(cleanStyle, "_new");
  Reflect.deleteProperty(cleanStyle, "xCenter");
  Reflect.deleteProperty(cleanStyle, "themesId");

  let cssCode = "";

  styleAry?.forEach(({ css, selector }: any) => {
    selector = selector
      .replace(":root", `${inSmartLayout ? "> *:first-child" : ""}`)
      .replace(/\{id\}/g, comId);

    cssCode += `.${com.props.id}${selector} {
      ${Object.entries(css)
        .map(([key, value]) => `${convertCamelToHyphen(key)}: ${value};`)
        .join("\n")}
    }`;
  });

  return {
    css: cssCode,
    style: cleanStyle,
  };
};

interface HandleProcessConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  getParams: () => Record<string, string>;
}
const handleProcess = (
  event: Exclude<ReturnType<BaseConfig["getEventByDiagramId"]>, undefined>,
  config: HandleProcessConfig,
) => {
  let code = "";
  const { process } = event;

  process.nodesDeclaration.forEach(({ meta, props }: any) => {
    if (meta.def.namespace === "mybricks.basic-comlib.ai-mix-js") {
      // 特殊处理，ai计算组件
      const { sourceCode } = props.data;
      const safeName = toSafeFileName(meta.id);
      config.addUtilFile(safeName, [
        {
          name: `${safeName}.ts`,
          content: decodeURIComponent(sourceCode),
        },
        {
          name: "index.ts",
          content: `import js from "./${safeName}";
import { createJSHandle } from "../../../../utils"

export default function(...values) {
  return createJSHandle(js, {
    props: {
      inputs: ${JSON.stringify(props.inputs)},
      outputs: ${JSON.stringify(props.outputs)},
      data: {}
    }
  })(...values)
};`,
        },
      ]);
      config.importManager.addImport({
        packageName: `./utils/${safeName}`,
        dependencyNames: [safeName],
        importType: "default",
      });
    }
  });

  process.nodesInvocation.forEach((props: any) => {
    const { componentType, category, runType } = props;
    // 参数
    const nextValue = getNextValue(props, config);
    // 节点执行后的返回值（输出）
    const nextCode = getNextCode(props);

    if (code) {
      // 换行
      code += "\n";
    }

    if (componentType === "js") {
      // 如何执行 js要区分自执行还是调用输入
      if (category === "normal") {
        const componentNameWithId = getComponentNameWithId(props);
        code +=
          `/** 调用 ${props.meta.title} */` +
          `\n${nextCode}${componentNameWithId}(${runType === "input" ? nextValue : ""})`;
      }
    } else {
      const inputId = props.id;

      config.refs.set(props.meta.id, true);

      code +=
        `/** 调用 ${props.meta.title} 的 ${props.title} */` +
        `\n${nextCode}${props.meta.id}Ref.current.${inputId}(${nextValue})`;
    }
  });

  return code;
};

const getNextValue = (props: any, config: HandleProcessConfig) => {
  const { paramSource } = props;
  const nextValue = paramSource.map((param: any) => {
    if (param.type === "params") {
      const params = config.getParams();
      return params[param.id];
    } else if (param.type === "constant") {
      // 常量
      return JSON.stringify(param.value);
    }
    // [TODO] 这里要判断类型的
    const { id, connectId, category, componentType } = param;
    const componentNameWithId = getComponentNameWithId(param);
    if (connectId) {
      if (componentType === "js" && category === "var") {
        return `${componentNameWithId}_${connectId}`;
      }
      const next = `${param.meta.id}_${param.id}_${param.connectId}`;
      // ui
      if (param.id === "_dataChanged_") {
        // 值更新的监听直接返回即可，这里和真机配合实现
        return next;
      }
      return `${next}.${param.id}`;
    }
    if (param.category === "frameOutput") {
      return `${componentNameWithId}_result`;
    } else if (param.category === "bus") {
      return `bus_${param.meta.id}.${id}`;
    } else if (param.category === "frameInput") {
      return `${componentNameWithId}_result`;
    }

    const next = `${componentNameWithId}_result`;
    return `${next}.${id}`;
  });

  return nextValue.join(", ");
};

const getComponentNameWithId = (props: any) => {
  const { componentType, category, meta, moduleId, type } = props;
  if (componentType === "js") {
    if (props.meta.def.namespace === "mybricks.core-comlib.scenes") {
      // 场景打开特殊处理，运行时内置实现
      return `page_${meta.id}`;
    } else if (
      props.meta.def.namespace === "mybricks.core-comlib.frame-output"
    ) {
      // frame输出特殊处理，运行时内置实现
      return `api_${meta.id}`;
    } else if (category === "var") {
      if (meta.global) {
        return `globalVars_${meta.title}`;
      }

      return `vars_${meta.title}`;
    } else if (category === "fx") {
      if (meta.global) {
        return `globalFxs_${meta.ioProxy.id}_${meta.id}`;
      }
      return `fxs_${meta.ioProxy.id}_${meta.id}`;
    } else if (category === "frameInput") {
      return `frameInput_${meta.id}`;
    } else if (category === "event") {
      return `event_${meta.id}`;
    }
  } else if (componentType === "ui") {
    if (category === "module") {
      if (type === "frameOutput") {
        return `props.${props.id}`;
      } else if (type === "frameRelOutput") {
        return `ref.current.outputs.${props.id}`;
      }
      return `Module_${moduleId}_${meta.id}`;
    }
  }

  return `${meta.id}`;
};

const getNextCode = (props: any) => {
  // 节点执行后的返回值（输出）
  const { nextParam, componentType, category } = props;
  if (!nextParam.length) {
    return "";
  }

  if (componentType === "js") {
    const componentNameWithId = getComponentNameWithId(props);
    if (category === "var") {
      return `const ${componentNameWithId}_${nextParam[0].connectId} = `;
    } else if (category === "bus") {
      return `const bus_${props.meta.id} = `;
    } else if (category === "scene") {
      // [TODO] harmony-render-utils里想办法解决类型问题
      return `const ${componentNameWithId}_result: MyBricks.EventValue = `;
    } else if (category === "frameInput") {
      return `const ${componentNameWithId}_result: MyBricks.EventValue = `;
    }

    const next = `${componentNameWithId}_result`;

    return `const ${next} = `;
  }

  if (!nextParam.length) {
    return "";
  }

  const nextComponentName = `${props.meta.id}_${nextParam[0].id}_${nextParam[0].connectId}`;

  return `const ${nextComponentName} = `;
};
