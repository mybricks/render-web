import type { UI, BaseConfig } from "./index";
import { convertHarmonyFlex, ImportManager } from "./utils";
import handleCom from "./handleCom";
import handleModule from "./handleModule";

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
      const ui = handleModule(child, config);
      uiCode += uiCode ? "\n" + ui : ui;
    } else {
      const { ui, js, slots, scopeSlots } = handleDom(child, config);
      uiCode += uiCode ? "\n" + ui : ui;
      jsCode += js;
      level0Slots.push(...slots);
      level1Slots.push(...scopeSlots);
    }
  });

  if (!props.style.width) {
    if (
      props.style.display === "flex" &&
      props.style.justifyContent !== "flex-end" // 单个组件又对齐，设置width(auto)导致Flex组件宽度没有撑开
    ) {
      props.style.width = "auto";
    }
  }
  if (!props.style.height) {
    props.style.height = "auto";
  }

  // 由于组件都有zIndex，同级Flex不设置一定被盖在下面
  props.style.zIndex = getMaxZIndex(children);

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

function getMaxZIndex(children: Dom["children"]) {
  return children.reduce((max, child) => {
    const zIndex = child.props.style.zIndex;
    return typeof zIndex === "number" ? Math.max(max, zIndex) : max;
  }, 1);
}
