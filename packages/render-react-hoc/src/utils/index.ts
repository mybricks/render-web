type Func = (value?: unknown) => void;

export function createFakePromise() {
  /** resolve的值，仅修改一次 */
  let nextValue: unknown;
  /** 是否已经准备就绪 */
  let ready = false;
  /** 注册的回调函数 */
  let func: Func;

  return {
    resolve(value: unknown) {
      nextValue = value;
      // 仅执行一次
      if (!ready) {
        ready = true;
        if (func) {
          func(nextValue);
        }
      }
    },
    then(fn: Func) {
      if (!ready) {
        func = fn;
      } else {
        fn(nextValue);
      }
    }
  }
}

export function createPromise() {
  let resolveFn = () => {};

  const promise = new Promise((resolve: (value?: unknown) => void) => {
    resolveFn = resolve;
  }) as Promise<unknown> & { resolve: (value?: unknown) => void };

  promise.resolve = resolveFn;

  return promise;
}
