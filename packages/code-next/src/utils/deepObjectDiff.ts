const isEmpty = (o: object) => Object.keys(o).length === 0;
const isObject = (o: unknown) => o != null && typeof o === "object";
const isArray = (o: unknown) => Array.isArray(o);
const isEmptyObject = (o: unknown) => isObject(o) && isEmpty(o);

const deepObjectDiff = <T extends Record<string, unknown>>(
  lhs: T,
  rhs: T,
): Partial<T> | T[keyof T] | Array<Partial<T> | T[keyof T]> => {
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
    const res: Array<Partial<T> | T[keyof T]> = [];

    rhs.forEach((value, index) => {
      const next = deepObjectDiff(lhs[index], value);
      res.push(isEmptyObject(next) ? value : next);
    });

    return res;
  }

  return Object.keys(rhs).reduce((acc, key) => {
    const next = deepObjectDiff(
      lhs[key] as Record<string, unknown>,
      rhs[key] as Record<string, unknown>,
    );

    if (isEmptyObject(next)) {
      return acc;
    }

    (acc as Record<string, unknown>)[key] = next;

    return acc;
  }, {} as Partial<T>);
};

export default deepObjectDiff;
