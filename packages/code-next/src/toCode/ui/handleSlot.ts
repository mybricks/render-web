import type { Slot, Style } from "../types";
import type { UiBaseConfig } from "../index";
import handleCom from "./handleCom";
import handleDom from "./handleDom";

type HandleSlotResult = {
  type: "dom";
  meta: {
    scope: boolean;
    slotId: string;
    comId?: string;
    namespace?: string;
    title: string;
  };
  props: {
    style: Style;
  };
  children: Array<ReturnType<typeof handleCom> | ReturnType<typeof handleDom>>;
};

const handleSlot = (slot: Slot, config: UiBaseConfig): HandleSlotResult => {
  const comInfo = config.getParentComInfo();
  const meta = {
    scope: slot.type === "scope",
    slotId: slot.id,
    comId: comInfo?.id,
    namespace: comInfo?.def.namespace,
    title: slot.title,
  };

  if (slot.style.layout === "smart") {
    return {
      type: "dom",
      meta,
      props: {
        style: slot.style,
      },
      children: slot.layoutTemplate.map((com) => {
        if ("def" in com) {
          return handleCom(com, config);
        }

        return handleDom(com, config);
      }),
    };
  }

  return {
    type: "dom",
    meta,
    props: {
      style: slot.style,
    },
    children: slot.comAry.map((com) => handleCom(com, config)),
  };
};

export default handleSlot;
