/** 将非数字、非英文字符转换为下划线 */
export function convertToUnderscore(input: string) {
  return input.replace(/[^a-zA-Z0-9]/g, "_");
}
