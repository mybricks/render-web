/** 将非数字、非英文字符转换为下划线 */
export function convertToUnderscore(input: string) {
  return input.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * 将驼峰式命名的字符串转换为连字符分隔的字符串。
 * @param {string} str - 驼峰式命名的字符串。
 * @returns {string} - 转换为连字符分隔的字符串。
 */
export function convertCamelToHyphen(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
