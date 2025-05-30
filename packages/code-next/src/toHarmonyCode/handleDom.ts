import type { UI, BaseConfig } from "./index";
import { convertHarmonyFlex, ImportManager } from "./utils";
import handleCom from "./handleCom";

type Dom = Extract<UI["children"][0], { type: "dom" }>;

interface HandleDomConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addController: (controller: string) => void;
  addConsumer: (provider: { name: string; class: string }) => void;
}

type HandleDomResult = {
  ui: string;
  js: string;
  slots: string[];
  scopeSlots: string[];
};

const handleDom = (dom: Dom, config: HandleDomConfig): HandleDomResult => {
  const { props, children } = dom;
  let uiCode = "";
  let jsCode = "";
  const level0Slots: string[] = [];
  const level1Slots: string[] = [];

  children.forEach((child) => {
    if (child.type === "com") {
      const { ui, js, slots, scopeSlots } = handleCom(child, config);
      uiCode += uiCode ? "\n" + ui : ui;
      jsCode += js;
      level0Slots.push(...slots);
      level1Slots.push(...scopeSlots);
    } else if (child.type === "module") {
      console.log("[出码 - TODO] dom嵌套模块");
    } else {
      const { ui, js, slots, scopeSlots } = handleDom(child, config);
      uiCode += uiCode ? "\n" + ui : ui;
      jsCode += js;
      level0Slots.push(...slots);
      level1Slots.push(...scopeSlots);
    }
  });

  if (!props.style.width) {
    props.style.width = "auto";
  }
  if (!props.style.height) {
    props.style.height = "auto";
  }

  const ui = convertHarmonyFlex(props.style, {
    child: uiCode,
  });

  return {
    ui,
    js: jsCode,
    slots: level0Slots,
    scopeSlots: level1Slots,
  };
};

export default handleDom;
