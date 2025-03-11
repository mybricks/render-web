import type { Com, ComInfo, Style } from "../types";
import type { UiBaseConfig } from "../index";
import handleSlot from "./handleSlot";

type HandleComResult = {
  type: "com";
  meta: ComInfo;
  props: {
    id: string;
    name: string;
    style: Style;
    data: ComInfo["model"]["data"];
  };
  slots?: Record<string, ReturnType<typeof handleSlot>>;
  events: Record<
    string,
    {
      type: "comEvent";
      diagramId: string;
    }
  >;
};

const handleCom = (com: Com, config: UiBaseConfig): HandleComResult => {
  const comInfo = config.getComInfo(com.id)!;

  return {
    type: "com",
    meta: comInfo,
    props: {
      id: com.id,
      name: com.name,
      style: comInfo.model.style,
      data: comInfo.model.data,
    },
    slots: com.slots
      ? Object.entries(com.slots).reduce<
          Record<string, ReturnType<typeof handleSlot>>
        >((pre, [slotId, slot]) => {
          pre[slotId] = handleSlot(slot, {
            ...config,
            getParentComInfo: () => comInfo,
          });

          return pre;
        }, {})
      : undefined,
    events: Object.entries(comInfo.model.outputEvents).reduce<
      HandleComResult["events"]
    >((pre, [eventId, events]) => {
      const event = events.find((event) => event.active)!;

      if (event.type === "defined" && event.options.id) {
        pre[eventId] = {
          type: "comEvent",
          diagramId: event.options.id,
        };
      }
      // [TODO] 事件可以直接调用fx

      return pre;
    }, {}),
  };
};

export default handleCom;
