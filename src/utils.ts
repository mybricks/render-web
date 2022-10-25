/**
 * 是 Object 或 Array
 * @param {*} value 任意值
 * @returns {boolean}
 */
export function isObject (value: any): boolean {
  return value && (typeof value === "object");
}
