/* eslint-disable @typescript-eslint/no-explicit-any */
import { TAG_TRANSLATE, TARGET_TYPE } from "./constant";
import type { UI, BaseConfig } from "./index";
import handleSlot from "./handleSlot";

export type Com = Extract<UI["children"][0], { type: "com" }>;

const handleCom = (com: Com, config: BaseConfig) => {
  const comDef = config.getComDef(com.meta.def);

  const comStyle = cleanStyle(com.props.style);
  const targetResult = comDef?.target?.[TARGET_TYPE[config.target]]?.({
    data: com.props.data,
    style: comStyle,
    slots: new Proxy(
      {},
      {
        get(_, slotId: string) {
          return {
            render() {
              const slot = com.slots?.[slotId];
              if (slot) {
                return handleSlot(slot, config);
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

  const divTag = TAG_TRANSLATE[config.target].div;

  return `<${divTag} style={${JSON.stringify(comStyle)}}>${targetResult?.jsx}</${divTag}>`;
};

export default handleCom;

const cleanStyle = (style: any) => {
  const cleanStyle = { ...style };
  Reflect.deleteProperty(cleanStyle, "_new");
  Reflect.deleteProperty(cleanStyle, "xCenter");
  return cleanStyle;
};
