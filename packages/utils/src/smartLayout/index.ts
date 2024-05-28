import combination, { ResultElement } from "./combination";

export type { ResultElement }

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
   * TODO: 临时样式信息，之后看是否可以优化，用于单组件和分组后组件合并时的重新计算间距等
   */
  // tempStyle?: any;
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
    widthFull?: boolean;
    /**
     * 是否X轴自适应
     */
    widthAuto?: boolean;
    /**
     * 是否Y轴填充
     */
    heightFull?: boolean;
    /**
     * 是否Y轴自适应
     */
    heightAuto?: boolean;
    /**
     * 横向、纵向排列
     */
    flexDirection?: "row" | "column";
    /**
     * 约束条件
     */
    // constraints?: Constraint[];
    /**
     * 临时测试用
     */
    backgroundColor?: string;
    /**
     * 不是自动成组的 - 插槽内的 true
     * 自动成组 - 计算获得的 false
     */
    isNotAutoGroup?: boolean;

    position?: string;
  };
  /**
   * 子组件，如果组件被分为一组
   */
  elements?: Elements;

  /** 相交关系 */
  brother?: Array<any>;

  /** 包含关系 */
  child?: any;
  // children: Array<any>;
}

export type Elements = Element[]

interface LayoutStyle {
  width: number;
  height: number;
  /** 如果为true，代表不是自动成组的，自动成组的元素内部不再自动计算居中关系 */
  isNotAutoGroup: boolean;
}

interface LayoutConfig {
  style: LayoutStyle;

  /**
   * 是否根slot，画布不参与高度的计算 - 这里的root目前主要是计算marginBottom的
   */
  root?: boolean;
}

interface DefaultLayoutStyle extends LayoutStyle {
  flexDirection: "row" | "column"
  top: number
  left: number
  right: number
  bottom: number
}

export interface DefaultLayoutConfig extends LayoutConfig {
  style: DefaultLayoutStyle
  // 从右往左计算
  startOnRight?: boolean

  // 从左往右计算
  startOnLeft?: boolean
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
        right: 0,
        bottom: 0,
        flexDirection: "column" // 页面默认是纵向排列
      },
      root: layoutConfig.root
    }
  )
}
