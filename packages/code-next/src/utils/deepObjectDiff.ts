/* eslint-disable @typescript-eslint/no-explicit-any */
const isEmpty = (o: unknown) => Object.keys(o as object).length === 0;
const isObject = (o: unknown) => o != null && typeof o === "object";
const isArray = (o: unknown) => Array.isArray(o);
const isEmptyObject = (o: unknown) => isObject(o) && isEmpty(o);

// [TODO] 类型补充
const deepObjectDiff = (lhs: any, rhs: any) => {
  if (lhs === rhs) {
    // 相等，不需要对比信息
    return {};
  }

  if (!isObject(lhs) || !isObject(rhs)) {
    // 不是对象类型，用对比的值
    return rhs;
  }

  if (isArray(rhs)) {
    // 类型一定相等不希要判断两者类型，判断其一即可
    const res: any[] = [];

    rhs.forEach((value: any, index: number) => {
      const next = deepObjectDiff((lhs as any[])[index], value);
      res.push(isEmptyObject(next) ? value : next);
    });

    return res;
  }

  return Object.keys(rhs).reduce((acc, key) => {
    const next = deepObjectDiff((lhs as any)[key], (rhs as any)[key]);

    if (isEmptyObject(next)) {
      return acc;
    }

    (acc as Record<string, unknown>)[key] = next;

    return acc;
  }, {});
};

export default deepObjectDiff;
