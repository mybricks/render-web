interface VariableDescriptor<T> {
  value: T;
  change: (value: T) => Promise<void>;
}

type WrappedVariable<T> = {
  [P in keyof T]: {
    /** 获取 */
    get: () => any;
    /** 赋值 */
    set: (value: any) => Promise<void>;
  };
};

export function variableWrapper<T extends Record<string, VariableDescriptor<any>>>(
  variable: T,
): WrappedVariable<T> {
  const wrapped: any = {};

  Object.keys(variable).forEach((key) => {
    const prop = variable[key];
    wrapped[key] = {
      get() {
        return prop.value
      },
      set(value: any) {
        prop.value = value;
        return prop.change(value);
      }
    }
  });

  return wrapped as WrappedVariable<T>;
}
