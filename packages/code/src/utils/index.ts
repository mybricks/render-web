import { convertToUnderscore } from "@mybricks/render-utils";

/** 函数名、文件名 */
export function getFunctionName({ namespace, id }: { namespace: string, id: string }) {
  var lastIndex = namespace.lastIndexOf('.');

  return convertToUnderscore(lastIndex !== -1 ? namespace.substring(lastIndex + 1) + `_${id}` : id);
}

// 字符串集合包含了大小写字母和数字
const UUID_CHARTS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function uuid(length: number = 2) {
  let id = '';
  // 随机选取两个字符
  for (let i = 0; i < length; i++) {
    id += UUID_CHARTS.charAt(Math.floor(Math.random() * UUID_CHARTS.length));
  }
  return id;
}