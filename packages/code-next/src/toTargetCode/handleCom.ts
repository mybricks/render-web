/* eslint-disable @typescript-eslint/no-explicit-any */
import { TARGET_TYPE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleSlot from "./handleSlot";
import { convertCamelToHyphen } from "./utils";

export type Com = Extract<UI["children"][0], { type: "com" }>;

const handleCom = (com: Com, config: BaseConfig) => {
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

    selector = selector.replace(/\{id\}/g, `${comId}`);

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
