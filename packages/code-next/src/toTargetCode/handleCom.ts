/* eslint-disable @typescript-eslint/no-explicit-any */
import { TARGET_TYPE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleSlot from "./handleSlot";
import { convertCamelToHyphen, toSafeFileName } from "./utils";

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

  // 假设 target 函数返回 { jsx, componentName, files: [] }
  const res = targetFn({
    title: com.meta.title,
    id: com.props.id,
    data: com.props.data,
    style,
    slots: com.slots, // 传递 slots 以防万一
  });

  if (!res) return null;

  // 1. 收集文件
  if (res.files && Array.isArray(res.files)) {
    config.addComponentFile(res.componentName, res.files);
  }

  // 2. 添加引用（相对于当前页面的 index.tsx，路径与 toTargetCode 中目录名一致）
  if (res.componentName) {
    const safeDir = toSafeFileName(res.componentName);
    config.importManager.addImport({
      packageName: `./components/${safeDir}`,
      dependencyNames: [res.componentName],
      importType: "default",
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

  const { styleAry, ...other } = style;
  const cleanStyle = { ...other };
  Reflect.deleteProperty(cleanStyle, "_new");
  Reflect.deleteProperty(cleanStyle, "xCenter");
  Reflect.deleteProperty(cleanStyle, "themesId");
  Reflect.deleteProperty(cleanStyle, "inSmartLayout");

  let cssCode = "";

  styleAry?.forEach(({ css, selector }: any) => {
    if (selector === ":root") {
      selector = "> *:first-child";
    }

    selector = selector.replace(/\{id\}/g, comId);

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
