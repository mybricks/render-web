/** 数字类型判断 */
export function isNumber(num: unknown) {
  return typeof num === "number" && !isNaN(num);
}

/** 字符类型判断 */
export function isString(str: unknown) {
  return typeof str === "string";
}
