import type { Com, ComInfo, Style } from "../types";
import type { UiBaseConfig } from "../index";
import handleSlot from "./handleSlot";
import { validateUiModule } from "../event/utils";
import handleDom from "./handleDom";

interface Result {
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
      type: ComInfo["model"]["outputEvents"][string][0]["type"];
      isAbstract?: boolean;
      diagramId: string;
    }
  >;
}

interface ResultCom extends Result {
  type: "com";
}

interface ResultModule extends Result {
  type: "module";
  moduleId: string;
}

type HandleComResult = ResultCom | ResultModule;

const handleCom = (com: Com, config: UiBaseConfig): HandleComResult => {
  const comInfo = config.getComInfo(com.id)!;
  const result = {
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

      pre[eventId] = {
        type: event.type,
        isAbstract: event.isAbstract,
        diagramId: event.options.id,
      };
      // [TODO] 事件可以直接调用fx

      return pre;
    }, {}),
    // [TODO] 智能布局包含关系的实现
    child: com.child ? handleDom(com.child, config) : null,
  };

  if (validateUiModule(comInfo.def.namespace)) {
    // 模块类型
    return {
      type: "module",
      moduleId: comInfo.model.data.definedId,
      ...result,
      props: {
        ...result.props,
        data: comInfo.model.data.configs || {},
      },
    };
  }

  return {
    type: "com",
    ...result,
  };
};

export default handleCom;
