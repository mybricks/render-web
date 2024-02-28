import combination from "./combination";

interface Constraint {
  /**
   * 如何对齐
   */
  type: "center" | "middle";
  /**
   * 对齐 画布｜组件 的ID
   */
  ref: {
    type: "slot" | "com";
    id: string
  }
}

/**
 * 元素信息
 */
export interface Element {
  /**
   * 唯一标识
   */
  id: string;
  /**
   * 样式信息
   */
  style: {
    /**
     * 宽
     */
    width: number;
    /**
     * 高
     */
    height: number;
    /**
     * 距上边距离
     */
    top: number;
    /**
     * 距左边距离
     */
    left: number;
    /**
     * 距右边距离 - 右对齐
     */
    right?: number;
    /**
     * 距下边距离 - 下对齐
     */
    bottom?: number;
    /**
     * 是否X轴填充
     */
    flexX: 1;
    /**
     * 横向、纵向排列
     */
    flexDirection?: "row" | "column";
    /**
     * 约束条件
     */
    constraints?: Constraint[];
    /**
     * 临时测试用
     */
    backgroundColor?: string;
  };
  /**
   * 子组件，如果组件被分为一组
   */
  elements: Elements
}

export type Elements = Element[]

interface LayoutStyle {
  width: number;
}

interface LayoutConfig {
  style: LayoutStyle
}

interface DefaultLayoutStyle extends LayoutStyle {
  flexDirection: "row" | "column"
  top: number
  left: number
}

export interface DefaultLayoutConfig extends LayoutConfig {
  style: DefaultLayoutStyle
}

export default function smartLayout(elements: Array<Element>, layoutConfig: LayoutConfig) {
  // console.log("执行smartLayout: ", { elements, layoutConfig })
  return combination(
    elements,
    {
      style: {
        ...layoutConfig.style,
        top: 0,
        left: 0,
        flexDirection: "column" // 页面默认是纵向排列
      }
    }
  )
}
