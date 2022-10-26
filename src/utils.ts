/**
 * 是 Object 或 Array
 * @param {*} value 任意值
 * @returns {boolean}
 */
export function isObject (value: any): boolean {
  return value && (typeof value === "object");
}

/**
 * 是 number
 * @param {*} num 任意值
 * @returns {boolean}
 */
export function isNumber(num: any) {
  return typeof num === "number" && !isNaN(num)
}
