import type { Dom, Style } from "../types";
import type { UiBaseConfig } from "../index";
import handleCom from "./handleCom";

type HandleDomResult = {
  type: "dom";
  props: {
    style: Style;
  };
  children: Array<ReturnType<typeof handleCom> | HandleDomResult>;
};

const handleDom = (dom: Dom, config: UiBaseConfig): HandleDomResult => {
  return {
    type: "dom",
    props: {
      style: dom.style,
    },
    children: dom.elements.map((element) => {
      if ("def" in element) {
        return handleCom(element, config);
      }

      return handleDom(element, config);
    }),
  };
};

export default handleDom;
