import type { Style, SlotStyle } from "@mybricks/render-types"

// TODO: 这里之后出码那里就处理干净吧

/** 计算插槽样式 */
export function getSlotStyle(style: SlotStyle, root?: boolean) {
  const { layout, ...other } = style;
  // @ts-ignore
  const slotStyle: Style = {
    position: "relative",
    ...other
  }
  // 判断布局方式
  if (layout === "flex-column") {
    slotStyle.display = "flex";
    slotStyle.flexDirection = "column";
  } else if (layout === "flex-row") {
    slotStyle.display = "flex";
    slotStyle.flexDirection = "row";
  } else {
    // 不是flex布局，删除引擎带来的运行时无用的样式
    Reflect.deleteProperty(slotStyle, "rowGap");
    Reflect.deleteProperty(slotStyle, "columnGap");
    Reflect.deleteProperty(slotStyle, "flexWrap");
    Reflect.deleteProperty(slotStyle, "alignItems");
    Reflect.deleteProperty(slotStyle, "justifyContent");
  }
  // 删除引擎带来的运行时无用的样式
  Reflect.deleteProperty(slotStyle, "widthFact");
  Reflect.deleteProperty(slotStyle, "heightFact");
  Reflect.deleteProperty(slotStyle, "widthAuto");
  Reflect.deleteProperty(slotStyle, "heightAuto");
  // 引擎返回的，干嘛用的这是
  Reflect.deleteProperty(slotStyle, "zoom");

  if (root) {
    // 画布根节点，宽高默认100%即可
    slotStyle.width = "100%";
    slotStyle.height = "100%";
  }

  // 解决子元素marginTop导致的外边距塌陷
  slotStyle.overflow = "hidden";

  return slotStyle;
}

/** 计算组件样式 */
export function getComponentStyle(style: Style) {
  // 组件外部的样式应该只保留position、以及宽高相关属性
  Reflect.deleteProperty(style, "display");

  if (style.position !== "absolute") {
    // 不是自由布局，删除四个方向属性
    Reflect.deleteProperty(style, "left");
    Reflect.deleteProperty(style, "top");
    Reflect.deleteProperty(style, "right");
    Reflect.deleteProperty(style, "bottom");
  }

  Reflect.deleteProperty(style, "flexDirection");

  // 删除引擎带来的运行时无用的样式
  Reflect.deleteProperty(style, "widthFact");
  Reflect.deleteProperty(style, "heightFact");
  Reflect.deleteProperty(style, "widthAuto");
  Reflect.deleteProperty(style, "heightAuto");
  
  return style;
}
