const isObject = (o: unknown) => o != null && typeof o === "object";
const isArray = (o: unknown) => Array.isArray(o);

const deepObjectMerge = <T extends Record<string, unknown>>(
  lhs: T,
  rhs: T,
): T => {
  if (!isObject(lhs) || !isObject(rhs)) {
    // 不是对象类型，用对比的值
    return rhs as T;
  }

  if (isArray(rhs)) {
    return rhs.map((value, index) => {
      if (index < (lhs as unknown as Array<T>).length) {
        // 长度未超出，尝试合并
        return deepObjectMerge(lhs[index] as Record<string, unknown>, value);
      }
      // 长度超出，直接用合并的值
      return value;
    }) as unknown as T;
  }

  return Object.keys(rhs).reduce(
    (acc, key) => {
      // 有key做对比，没有直接赋值
      (acc as Record<string, unknown>)[key] =
        key in lhs
          ? deepObjectMerge(
              lhs[key] as Record<string, unknown>,
              rhs[key] as Record<string, unknown>,
            )
          : rhs[key];
      return acc;
    },
    { ...lhs },
  );
};

export default deepObjectMerge;
