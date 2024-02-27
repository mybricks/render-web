import combination from "./combination";

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
     * 是否X轴填充
     */
    flexX: 1;

    flexDirection?: "row" | "column";

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
