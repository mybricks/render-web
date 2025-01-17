/**
 * 判断是否js多输入
 * [TODO]: 和code-next重复，归到utils里去
 */
export const validateJsMultipleInputs = (input: string) => {
  return input.match(/\./); // input.xxx 为多输入模式
};
