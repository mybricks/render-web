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
}

export default function smartLayout(elements: Array<Element>) {
  return combination(elements)
}