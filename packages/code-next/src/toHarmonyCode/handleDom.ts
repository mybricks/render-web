import type { UI, BaseConfig } from "./index";
import { convertHarmonyFlexComponent, ImportManager } from "./utils";
import handleCom from "./handleCom";
import handleModule from "./handleModule";

type Dom = Extract<UI["children"][0], { type: "dom" }>;

interface HandleDomConfig extends BaseConfig {
  addParentDependencyImport: (typeof ImportManager)["prototype"]["addImport"];
  addConsumer: (provider: ReturnType<BaseConfig["getCurrentProvider"]>) => void;
  addComId: (comId: string) => void;
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
  const nextConfig = {
    ...config,
    depth: config.depth + 1,
  };

  children.forEach((child) => {
    if (child.type === "com") {
      const { ui, js, slots, scopeSlots } = handleCom(child, nextConfig);
      uiCode += uiCode ? "\n\n" + ui : ui;
      jsCode += js;
      level0Slots.push(...slots);
      level1Slots.push(...scopeSlots);
    } else if (child.type === "module") {
      const ui = handleModule(child, nextConfig);
      uiCode += uiCode ? "\n\n" + ui : ui;
    } else {
      const { ui, js, slots, scopeSlots } = handleDom(child, nextConfig);
      uiCode += uiCode ? "\n\n" + ui : ui;
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
  if (props.style.flex) {
    // 有flex代表需要填充，鸿蒙Flex组件内如果没子组件，不设置width，不会撑开
    props.style.width = "100%";
  }
  if (!props.style.height) {
    props.style.height = "auto";
  }

  // 由于组件都有zIndex，同级Flex不设置一定被盖在下面
  props.style.zIndex = getMaxZIndex(children);

  const ui = convertHarmonyFlexComponent(props.style, {
    scope: false,
    child: uiCode,
    indentSize: config.codeStyle!.indent,
    initialIndent: config.codeStyle!.indent * config.depth,
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
