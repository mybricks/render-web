/** 数字类型判断 */
export function isNumber(num: unknown) {
  return typeof num === "number" && !isNaN(num);
}
