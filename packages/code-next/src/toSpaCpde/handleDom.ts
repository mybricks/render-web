import type { UI, BaseConfig } from "./index";
import { createDependencyImportCollector } from "./utils";
import handleCom from "./handleCom";

type Dom = Extract<UI["children"][0], { type: "dom" }>;

interface HandleDomConfig extends BaseConfig {
  addParentDependencyImport: ReturnType<
    typeof createDependencyImportCollector
  >[1];
  addRefName: (refName: string) => void;
  addSlotContext: (slotContext: string) => void;
}

type HandleDomResult = {
  ui: string;
};

const handleDom = (dom: Dom, config: HandleDomConfig): HandleDomResult => {
  const { props, children } = dom;

  const propsCode = Object.entries(props).reduce((pre, [key, value]) => {
    return pre + `${key}={${JSON.stringify(value)}} `;
  }, "");

  const childrenCode = children.reduce((pre, child) => {
    if (child.type === "com") {
      // const { code } = handleCom(child, config);
      // return pre + code;
      const { ui, js } = handleCom(child, config);
      // eslint-disable-next-line no-debugger
      debugger;
      console.log("com => ", {
        ui,
        js,
      });
      return pre;
    }
    const { ui } = handleDom(child, config);
    return pre + ui;
  }, "");

  return {
    ui: `<div ${propsCode}>${childrenCode}</div>`,
  };
};

export default handleDom;
