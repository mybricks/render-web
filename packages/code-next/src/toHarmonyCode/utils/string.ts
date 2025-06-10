import { pinyin } from "./pinyin";

/** 将第一个字符转小写 */
const firstCharToUpperCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/** 仅保留中文0-9a-zA-Z，按中文拆分，非中文连写 */
const cleanAndSplitString = (str: string): string[] => {
  // 移除所有非中文、非数字、非大小写字母的字符
  // [\u4e00-\u9fa5] 中文字符范围
  const cleanedStr = str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");

  // 按中文分割字符串
  return cleanedStr.match(/[\u4e00-\u9fa5]|[^\u4e00-\u9fa5]+/g) || [];
};

const getName = (text: string) => {
  const splits = cleanAndSplitString(text);

  return splits.reduce((pre, cur) => {
    return pre + firstCharToUpperCase(pinyin.convertToPinyin(cur, "", true));
  }, "");
};

export { cleanAndSplitString, getName, firstCharToUpperCase };
