/* eslint-disable @typescript-eslint/no-explicit-any */

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
    // 作用域插槽一定有
    frame?: {
      inputs: Array<{ id: string; title: string; schema: any }>;
      outputs: Array<{ id: string; title: string; schema: any }>;
    };
  };
  props: {
    style: Style;
  };
  children: Array<ReturnType<typeof handleCom> | ReturnType<typeof handleDom>>;
};

const handleSlot = (slot: Slot, config: UiBaseConfig): HandleSlotResult => {
  const comInfo = config.getParentComInfo();
  const scope = slot.type === "scope";

  const meta = {
    scope,
    slotId: slot.id,
    comId: comInfo?.id,
    namespace: comInfo?.def.namespace,
    title: slot.title,
    frame: scope
      ? comInfo?.frames?.find((frame) => frame.id === slot.id)
      : undefined,
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
