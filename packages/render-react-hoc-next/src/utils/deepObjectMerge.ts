/* eslint-disable @typescript-eslint/no-explicit-any */
const isObject = (o: unknown) => o != null && typeof o === "object";
const isArray = (o: unknown) => Array.isArray(o);

// [TODO] 类型补充
const deepObjectMerge = (lhs: any, rhs: any): any => {
  if (!isObject(lhs) || !isObject(rhs)) {
    // 不是对象类型，用对比的值
    return rhs;
  }

  if (isArray(rhs)) {
    return rhs.map((value: any, index: number) => {
      if (index < (lhs as any).length) {
        // 长度未超出，尝试合并
        return deepObjectMerge((lhs as any)[index], value);
      }
      // 长度超出，直接用合并的值
      return value;
    });
  }

  return Object.keys(rhs).reduce(
    (acc, key) => {
      // 有key做对比，没有直接赋值
      (acc as any)[key] =
        key in lhs
          ? deepObjectMerge((lhs as any)[key], (rhs as any)[key])
          : (rhs as any)[key];
      return acc;
    },
    { ...lhs },
  );
};

export default deepObjectMerge;
